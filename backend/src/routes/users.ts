import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { emailChangeLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { sendEmailChangeVerification } from '../lib/brevo.js';

const router = Router();

const USER_COLUMNS = `id, name, email, phone_number AS "phoneNumber", address, role, profile_image AS "profileImage", is_active AS "isActive", is_unread AS "unread", created_at AS "registrationDate"`;

// GET /api/users - admin: list all users
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
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/users - admin: create a user directly
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, phoneNumber, address, role, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone_number, address, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${USER_COLUMNS}`,
      [name, email, phoneNumber ?? null, address ?? null, role, passwordHash]
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(err);
  }
});

const updateSelfSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  profileImage: z.string().nullable().optional(), // string to set, null to remove, omitted to leave unchanged
  password: z.string().min(8).optional(),
});

// PATCH /api/users/me - any authenticated user: update own profile
router.patch('/me', authenticate, async (req, res, next) => {
  const parsed = updateSelfSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, phoneNumber, address, profileImage, password } = parsed.data;
  const profileImageProvided = 'profileImage' in parsed.data;

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         phone_number = COALESCE($2, phone_number),
         address = COALESCE($3, address),
         profile_image = CASE WHEN $4 THEN $5 ELSE profile_image END,
         password_hash = COALESCE($6, password_hash)
       WHERE id = $7
       RETURNING ${USER_COLUMNS}`,
      [name ?? null, phoneNumber ?? null, address ?? null, profileImageProvided, profileImage ?? null, passwordHash, req.authUser!.id]
    );
    return res.json({ user: result.rows[0] });
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

    const takenResult = await pool.query(`SELECT id FROM users WHERE email = $1`, [newEmail]);
    if ((takenResult.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour')`,
      [req.authUser!.id, newEmail, tokenHash]
    );
    const appUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    const confirmUrl = `${appUrl}/confirm-email-change?token=${rawToken}`;
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

      try {
        await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [tokenRow.newEmail, tokenRow.userId]);
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
          throw new HttpError(409, 'An account with this email already exists.');
        }
        throw err;
      }
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
  email: z.string().trim().toLowerCase().email().optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// PATCH /api/users/:id - admin: update any user
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, phoneNumber, address, role, isActive, password } = parsed.data;

  if (isActive === false && req.authUser!.id === req.params.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone_number = COALESCE($3, phone_number),
         address = COALESCE($4, address),
         role = COALESCE($5, role),
         is_active = COALESCE($6, is_active),
         password_hash = COALESCE($7, password_hash)
       WHERE id = $8
       RETURNING ${USER_COLUMNS}`,
      [name ?? null, email ?? null, phoneNumber ?? null, address ?? null, role ?? null, isActive ?? null, passwordHash, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(err);
  }
});

// DELETE /api/users/:id - admin: delete a user
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
