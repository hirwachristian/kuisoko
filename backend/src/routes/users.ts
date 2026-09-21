import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { emailChangeLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { assertEmailAccountCapacity, MAX_ACCOUNTS_PER_EMAIL } from '../lib/accountLimits.js';
import { getAppUrl } from '../lib/appUrl.js';
import { generateUserId, isUserIdCollision } from '../lib/userId.js';
import { sendEmailChangeVerification } from '../lib/brevo.js';

const router = Router();

const USER_COLUMNS = `id, name, username, email, phone_number AS "phoneNumber", address, role, profile_image AS "profileImage", is_active AS "isActive", is_unread AS "unread", two_factor_enabled AS "twoFactorEnabled", created_at AS "registrationDate"`;

// Public-facing handle - shown on reviews instead of the account's real name. Doesn't affect
// login/2FA/password-reset, which all stay keyed on email.
const usernameSchema = z.string().trim().toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores');

router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY name`);
    return res.json({ users: result.rows });
  } catch (err) {
    return next(err);
  }
});

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  // Optional here (unlike self-signup) - the admin "Add User" form doesn't collect one, so a
  // reasonable handle is generated from the name if omitted rather than blocking account creation.
  username: usernameSchema.optional(),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(['user', 'admin', 'rider']).default('user'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, username, email, phoneNumber, address, role, password } = parsed.data;
  const finalUsername = username ?? `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${crypto.randomBytes(3).toString('hex')}`;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    for (let attempt = 0; ; attempt++) {
      try {
        user = await withTransaction(async (client) => {
          await assertEmailAccountCapacity(client, email);
          const result = await client.query(
            `INSERT INTO users (id, name, username, email, phone_number, address, role, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING ${USER_COLUMNS}`,
            [generateUserId(), name, finalUsername, email, phoneNumber ?? null, address ?? null, role, passwordHash]
          );
          return result.rows[0];
        });
        break;
      } catch (err) {
        if (isUserIdCollision(err) && attempt < 4) continue;
        throw err;
      }
    }
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'This username already exists.' });
    }
    return next(err);
  }
});

const updateSelfSchema = z.object({
  name: z.string().trim().min(1).optional(),
  username: usernameSchema.optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  profileImage: z.string().nullable().optional(), // string to set, null to remove, omitted to leave unchanged
  password: z.string().min(8).optional(),
  currentPassword: z.string().optional(),
});

// PATCH /api/users/me - any authenticated user: update own profile. Changing the password
// requires re-entering the current one - an already-authenticated session (e.g. a stolen token)
// shouldn't by itself be enough to lock the real owner out of their own account.
router.patch('/me', authenticate, async (req, res, next) => {
  const parsed = updateSelfSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, username, phoneNumber, address, profileImage, password, currentPassword } = parsed.data;
  const profileImageProvided = 'profileImage' in parsed.data;

  try {
    if (password) {
      const userResult = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.authUser!.id]);
      if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
      if (!currentPassword || !(await bcrypt.compare(currentPassword, userResult.rows[0].password_hash))) {
        return res.status(403).json({ error: 'Current password is incorrect.' });
      }
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         username = COALESCE($2, username),
         phone_number = COALESCE($3, phone_number),
         address = COALESCE($4, address),
         profile_image = CASE WHEN $5 THEN $6 ELSE profile_image END,
         password_hash = COALESCE($7, password_hash)
       WHERE id = $8
       RETURNING ${USER_COLUMNS}`,
      [name ?? null, username ?? null, phoneNumber ?? null, address ?? null, profileImageProvided, profileImage ?? null, passwordHash, req.authUser!.id]
    );
    return res.json({ user: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'This username already exists.' });
    }
    return next(err);
  }
});

const pushTokenSchema = z.object({
  token: z.string().trim().min(1),
  platform: z.enum(['ios', 'android']).optional(),
});

// POST /api/users/me/push-token - the mobile app only (website has no equivalent) - registers this
// device's Expo push token against the signed-in account. Upserts on the token itself, not
// (userId, token), since a token can only ever belong to one install - re-registering the same
// token (app reopened, or a different account signed in on the same device) just re-points it.
router.post('/me/push-token', authenticate, async (req, res, next) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform`,
      [req.authUser!.id, parsed.data.token, parsed.data.platform ?? null]
    );
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/users/me/push-token - called on logout, so a signed-out device stops receiving
// pushes meant for the account that just left it.
router.delete('/me/push-token', authenticate, async (req, res, next) => {
  const parsed = z.object({ token: z.string().trim().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await pool.query(`DELETE FROM push_tokens WHERE token = $1 AND user_id = $2`, [parsed.data.token, req.authUser!.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const requestEmailChangeSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Invalid email address'),
});

// POST /api/users/me/email-change - any authenticated user: request to change their own email.
// Doesn't change anything yet - emails a confirmation link to the *new* address, so the change
// only takes effect once that inbox is proven to be under the user's control.
router.post('/me/email-change', authenticate, emailChangeLimiter, async (req, res, next) => {
  const parsed = requestEmailChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { newEmail } = parsed.data;

  try {
    const meResult = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [req.authUser!.id]);
    const me = meResult.rows[0];
    if (!me) return res.status(404).json({ error: 'User not found.' });
    if (newEmail === me.email) {
      return res.status(400).json({ error: 'That is already your current email address.' });
    }

    const countResult = await pool.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [newEmail]);
    if (countResult.rows[0].count >= MAX_ACCOUNTS_PER_EMAIL) {
      return res.status(409).json({
        error: `That email address already has the maximum of ${MAX_ACCOUNTS_PER_EMAIL} accounts.`,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [req.authUser!.id, newEmail, tokenHash]
    );
    const confirmUrl = `${getAppUrl()}/confirm-email-change?token=${rawToken}`;
    sendEmailChangeVerification(newEmail, me.name, confirmUrl); // fire-and-forget

    return res.json({ message: `A verification link has been sent to ${newEmail}. Confirm it to finish changing your email.` });
  } catch (err) {
    return next(err);
  }
});

const confirmEmailChangeSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// POST /api/users/email-change/confirm - public: consumes a single-use token to apply a
// previously-requested email change. Not authenticated on purpose (mirrors /auth/reset-password)
// - the confirmation link may well be opened from a different device/session than the one that
// requested the change (e.g. checking the new inbox on a phone).
router.post('/email-change/confirm', async (req, res, next) => {
  const parsed = confirmEmailChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');

  try {
    await withTransaction(async (client) => {
      const tokenResult = await client.query(
        `SELECT id, user_id AS "userId", new_email AS "newEmail" FROM email_change_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [tokenHash]
      );
      const tokenRow = tokenResult.rows[0];
      if (!tokenRow) {
        throw new HttpError(400, 'This email verification link is invalid or has expired.');
      }

      await assertEmailAccountCapacity(client, tokenRow.newEmail);
      await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [tokenRow.newEmail, tokenRow.userId]);
      await client.query(`UPDATE email_change_tokens SET used_at = now() WHERE id = $1`, [tokenRow.id]);
      // Invalidate any other outstanding email-change links for this account.
      await client.query(
        `UPDATE email_change_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
        [tokenRow.userId]
      );
    });
    return res.json({ message: 'Your email address has been updated. Please sign in again with your new email.' });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

// DELETE /api/users/me - any authenticated user: delete own account
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.authUser!.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  username: usernameSchema.optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(['user', 'admin', 'rider']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, username, email, phoneNumber, address, role, isActive, password } = parsed.data;

  if (isActive === false && req.authUser!.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const user = await withTransaction(async (client) => {
      if (email) {
        const currentResult = await client.query(`SELECT email FROM users WHERE id = $1`, [req.params.id]);
        if (currentResult.rowCount === 0) {
          throw new HttpError(404, 'User not found.');
        }
        if (currentResult.rows[0].email !== email) {
          await assertEmailAccountCapacity(client, email);
        }
      }
      const result = await client.query(
        `UPDATE users SET
           name = COALESCE($1, name),
           username = COALESCE($2, username),
           email = COALESCE($3, email),
           phone_number = COALESCE($4, phone_number),
           address = COALESCE($5, address),
           role = COALESCE($6, role),
           is_active = COALESCE($7, is_active),
           password_hash = COALESCE($8, password_hash)
         WHERE id = $9
         RETURNING ${USER_COLUMNS}`,
        [name ?? null, username ?? null, email ?? null, phoneNumber ?? null, address ?? null, role ?? null, isActive ?? null, passwordHash, req.params.id]
      );
      if (result.rowCount === 0) {
        throw new HttpError(404, 'User not found.');
      }
      return result.rows[0];
    });
    return res.json({ user });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'This username already exists.' });
    }
    return next(err);
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/users/:id/read - admin: mark a user's registration as read
router.patch('/:id/read', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_unread = false WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

export default router;
