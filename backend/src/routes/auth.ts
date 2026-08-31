import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { signToken, signTwoFactorPendingToken, verifyTwoFactorPendingToken } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, signupLimiter, forgotPasswordLimiter, twoFactorVerifyLimiter, twoFactorCodeLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendTwoFactorCodeEmail } from '../lib/brevo.js';

const router = Router();

const USER_COLUMNS = `id, name, email, phone_number AS "phoneNumber", address, role, profile_image AS "profileImage", is_active AS "isActive", two_factor_enabled AS "twoFactorEnabled", created_at AS "registrationDate"`;

/** Generates a 6-digit numeric code, stores its SHA-256 hash (never the raw code) with a 10-minute
 * expiry, and emails the raw code - shared by the login-2FA-challenge, resend, and enable-setup
 * flows below, which all just need "send the account holder a code and remember its hash". */
async function issueTwoFactorCode(userId: string, email: string, name: string): Promise<void> {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await pool.query(
    `INSERT INTO two_factor_codes (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
    [userId, codeHash]
  );
  sendTwoFactorCodeEmail(email, name, code); // fire-and-forget, same pattern as the other auth emails
}

const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  phoneNumber: z.string().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/signup', signupLimiter, async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { fullName, email, phoneNumber, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone_number, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING ${USER_COLUMNS}`,
      [fullName, email, phoneNumber ?? null, passwordHash]
    );
    const user = result.rows[0];
    const token = signToken({ sub: user.id, role: user.role });
    sendWelcomeEmail(user.email, user.name); // fire-and-forget - signup shouldn't fail if the email does
    return res.status(201).json({ user, token });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS}, password_hash
       FROM users WHERE email = $1`,
      [email]
    );
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!row.isActive) {
      return res.status(403).json({ error: 'Unable to login, please contact KuISOKO for help.' });
    }

    // Correct password, but not signed in yet - the account still needs to prove it received the
    // emailed code before a real session token is issued. The pendingToken is the only thing the
    // client gets back; it carries no role and is rejected by every authenticated route (see
    // verifyToken in lib/auth.ts), so it can't be used to skip this step.
    if (row.twoFactorEnabled) {
      await issueTwoFactorCode(row.id, row.email, row.name);
      const pendingToken = signTwoFactorPendingToken(String(row.id));
      return res.json({ requiresTwoFactor: true, pendingToken });
    }

    const { password_hash, ...user } = row;
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ user, token });
  } catch (err) {
    return next(err);
  }
});

const twoFactorVerifySchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

// POST /api/auth/2fa/verify - the second login step when 2FA is enabled: exchanges a pendingToken
// (from /login) + the emailed code for a real session token, exactly like /login normally returns.
router.post('/2fa/verify', twoFactorVerifyLimiter, async (req, res, next) => {
  const parsed = twoFactorVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  let userId: string;
  try {
    userId = verifyTwoFactorPendingToken(parsed.data.pendingToken);
  } catch {
    return res.status(401).json({ error: 'This sign-in attempt has expired. Please sign in again.' });
  }

  const codeHash = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
  try {
    const user = await withTransaction(async (client) => {
      const codeResult = await client.query(
        `SELECT id FROM two_factor_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [userId, codeHash]
      );
      if (codeResult.rowCount === 0) {
        throw new HttpError(401, 'Invalid or expired code.');
      }
      await client.query(`UPDATE two_factor_codes SET used_at = now() WHERE id = $1`, [codeResult.rows[0].id]);

      const userResult = await client.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
      return userResult.rows[0];
    });
    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ user, token });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

const twoFactorPendingSchema = z.object({ pendingToken: z.string().min(1) });

// POST /api/auth/2fa/resend - issues a fresh code for the same in-progress login, invalidating
// whatever code was sent before (in case it expired or the first email never arrived).
router.post('/2fa/resend', twoFactorCodeLimiter, async (req, res, next) => {
  const parsed = twoFactorPendingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A valid pending login is required.' });
  }
  let userId: string;
  try {
    userId = verifyTwoFactorPendingToken(parsed.data.pendingToken);
  } catch {
    return res.status(401).json({ error: 'This sign-in attempt has expired. Please sign in again.' });
  }

  try {
    const userResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    await pool.query(`UPDATE two_factor_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
    await issueTwoFactorCode(user.id, user.email, user.name);
    return res.json({ message: 'A new code has been sent to your email.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/2fa/enable/start - authenticated: sends a code to the current user's own email,
// to confirm they can actually receive it before 2FA is switched on (otherwise a wrong/unreachable
// address would lock them out of their own account at the next login).
router.post('/2fa/enable/start', authenticate, twoFactorCodeLimiter, async (req, res, next) => {
  try {
    const userResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [req.authUser!.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await issueTwoFactorCode(user.id, user.email, user.name);
    return res.json({ message: 'A verification code has been sent to your email.' });
  } catch (err) {
    return next(err);
  }
});

const twoFactorEnableConfirmSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

// POST /api/auth/2fa/enable/confirm - authenticated: consumes the code from enable/start and
// actually turns 2FA on.
router.post('/2fa/enable/confirm', authenticate, async (req, res, next) => {
  const parsed = twoFactorEnableConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const codeHash = crypto.createHash('sha256').update(parsed.data.code).digest('hex');
  try {
    const user = await withTransaction(async (client) => {
      const codeResult = await client.query(
        `SELECT id FROM two_factor_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [req.authUser!.id, codeHash]
      );
      if (codeResult.rowCount === 0) {
        throw new HttpError(400, 'Invalid or expired code.');
      }
      await client.query(`UPDATE two_factor_codes SET used_at = now() WHERE id = $1`, [codeResult.rows[0].id]);
      const userResult = await client.query(
        `UPDATE users SET two_factor_enabled = true WHERE id = $1 RETURNING ${USER_COLUMNS}`,
        [req.authUser!.id]
      );
      return userResult.rows[0];
    });
    return res.json({ user, message: 'Two-factor authentication is now enabled.' });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

const twoFactorDisableSchema = z.object({ password: z.string().min(1, 'Password is required') });

// POST /api/auth/2fa/disable - authenticated: re-checks the account password (rather than an
// emailed code) before turning 2FA off, so a session left signed in on a shared device can't be
// used to silently disable the account's second factor.
router.post('/2fa/disable', authenticate, async (req, res, next) => {
  const parsed = twoFactorDisableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.authUser!.id]);
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    const userResult = await pool.query(
      `UPDATE users SET two_factor_enabled = false WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.authUser!.id]
    );
    return res.json({ user: userResult.rows[0], message: 'Two-factor authentication has been disabled.' });
  } catch (err) {
    return next(err);
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

// POST /api/auth/forgot-password - always returns the same generic response, whether or
// not the email exists, so this can't be used to check which addresses have accounts.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const genericMessage = { message: 'If an account exists for that email, a password reset link has been sent.' };

  try {
    const userResult = await pool.query(`SELECT id, name, email FROM users WHERE email = $1`, [parsed.data.email]);
    const user = userResult.rows[0];
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
        [user.id, tokenHash]
      );
      const appUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      sendPasswordResetEmail(user.email, user.name, resetUrl); // fire-and-forget
    }
    return res.json(genericMessage);
  } catch (err) {
    return next(err);
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/reset-password - consumes a single-use token to set a new password.
router.post('/reset-password', async (req, res, next) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');

  try {
    await withTransaction(async (client) => {
      const tokenResult = await client.query(
        `SELECT id, user_id AS "userId" FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [tokenHash]
      );
      const tokenRow = tokenResult.rows[0];
      if (!tokenRow) {
        throw new HttpError(400, 'This password reset link is invalid or has expired.');
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, tokenRow.userId]);
      await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [tokenRow.id]);
      // Invalidate any other outstanding reset links for this account.
      await client.query(
        `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
        [tokenRow.userId]
      );
    });
    return res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [req.authUser!.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

export default router;
