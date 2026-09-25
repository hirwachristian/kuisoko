import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { signToken, signTwoFactorPendingToken, verifyTwoFactorPendingToken } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, signupLimiter, forgotPasswordLimiter, forgotPasswordLookupLimiter, twoFactorVerifyLimiter, twoFactorCodeLimiter, usernameCheckLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { assertEmailAccountCapacity } from '../lib/accountLimits.js';
import { getAppUrl } from '../lib/appUrl.js';
import { generateUserId, isUserIdCollision } from '../lib/userId.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendTwoFactorCodeEmail } from '../lib/brevo.js';

const router = Router();

const USER_COLUMNS = `id, name, username, email, phone_number AS "phoneNumber", address, role, profile_image AS "profileImage", is_active AS "isActive", two_factor_enabled AS "twoFactorEnabled", created_at AS "registrationDate", balance`;

// Public-facing handle - shown on reviews, but also doubles as the unique login/password-reset
// identifier now that one email can back multiple accounts (see accountLimits.ts).
const usernameSchema = z.string().trim().toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores');

/** Partially hides an email for the forgot-password "we'll send it to j***e@g****.com" preview -
 * enough for the account holder to recognize their own inbox without fully exposing it. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const domainParts = domain.split('.');
  const maskedLocal = local.length <= 2 ? `${local[0]}*` : `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}`;
  const firstLabel = domainParts[0];
  const maskedFirstLabel = firstLabel.length <= 1 ? '*' : `${firstLabel[0]}${'*'.repeat(firstLabel.length - 1)}`;
  return `${maskedLocal}@${maskedFirstLabel}.${domainParts.slice(1).join('.')}`;
}

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

/** Any past guest checkout under this email (no account existed yet, so the order has no
 * user_id) now belongs to this account - links it retroactively so it shows up under "My Orders"
 * instead of being permanently orphaned. Called wherever a session actually starts: signup, plain
 * login, and 2FA verification (2FA is available to any user, not just admins, so an order placed
 * as a guest before enabling it would otherwise never get linked). Best-effort: a failure here
 * shouldn't fail the login/signup itself. */
async function linkGuestOrders(userId: string, email: string): Promise<void> {
  try {
    await pool.query(`UPDATE orders SET user_id = $1 WHERE user_id IS NULL AND customer_email = $2`, [userId, email]);
  } catch (err) {
    console.error('Could not link past guest orders to account:', err);
  }
}

/** Instagram-style "taken? here are some free ones" suggestions - built from the requested
 * username so they still look like what the person typed, rather than a random handle. */
function generateUsernameSuggestions(base: string): string[] {
  const year = new Date().getFullYear();
  const randomDigits = () => crypto.randomInt(10, 1000).toString();
  const candidates = [
    `${base}${randomDigits()}`,
    `${base}_${randomDigits()}`,
    `the_${base}`,
    `real_${base}`,
    `${base}_official`,
    `${base}${year}`,
    `its_${base}`,
    `${base}${randomDigits()}`,
  ];
  return [...new Set(candidates)];
}

router.get('/check-username', usernameCheckLimiter, async (req, res, next) => {
  const parsed = usernameSchema.safeParse(req.query.username);
  if (!parsed.success) {
    return res.status(400).json({ available: false, error: parsed.error.issues[0].message });
  }
  const username = parsed.data;

  try {
    const existing = await pool.query(`SELECT 1 FROM users WHERE username = $1`, [username]);
    if (existing.rowCount === 0) {
      return res.json({ available: true });
    }

    const candidates = generateUsernameSuggestions(username);
    const taken = await pool.query(`SELECT username FROM users WHERE username = ANY($1)`, [candidates]);
    const takenSet = new Set(taken.rows.map((r) => r.username));
    const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 4);
    return res.json({ available: false, error: 'This username already exists.', suggestions });
  } catch (err) {
    return next(err);
  }
});

const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  phoneNumber: z.string().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/signup', signupLimiter, async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { fullName, username, email, phoneNumber, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    for (let attempt = 0; ; attempt++) {
      try {
        user = await withTransaction(async (client) => {
          await assertEmailAccountCapacity(client, email);
          const result = await client.query(
            `INSERT INTO users (id, name, username, email, phone_number, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, $6, 'user')
             RETURNING ${USER_COLUMNS}`,
            [generateUserId(), fullName, username, email, phoneNumber ?? null, passwordHash]
          );
          return result.rows[0];
        });
        break;
      } catch (err) {
        if (isUserIdCollision(err) && attempt < 4) continue; // vanishingly rare - just try a fresh id
        throw err;
      }
    }
    const token = signToken({ sub: user.id, role: user.role });
    await linkGuestOrders(user.id, user.email);
    sendWelcomeEmail(user.email, user.name); // fire-and-forget - signup shouldn't fail if the email does
    return res.status(201).json({ user, token });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      const suggestions = generateUsernameSuggestions(username);
      const taken = await pool.query(`SELECT username FROM users WHERE username = ANY($1)`, [suggestions]);
      const takenSet = new Set(taken.rows.map((r) => r.username));
      return res.status(409).json({
        error: 'This username already exists.',
        suggestions: suggestions.filter((s) => !takenSet.has(s)).slice(0, 4),
      });
    }
    return next(err);
  }
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { password } = parsed.data;
  const identifier = parsed.data.identifier.toLowerCase();
  const isEmail = identifier.includes('@');

  try {
    // A username is globally unique, so this always returns at most one row. An email is no
    // longer unique (one address can back up to MAX_ACCOUNTS_PER_EMAIL accounts) - it can return
    // several, and the password is what disambiguates which one is actually signing in.
    const result = await pool.query(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE ${isEmail ? 'email' : 'username'} = $1`,
      [identifier]
    );

    const matches = [];
    for (const row of result.rows) {
      if (await bcrypt.compare(password, row.password_hash)) matches.push(row);
    }

    if (matches.length === 0) {
      return res.status(401).json({ error: 'Invalid email/username or password.' });
    }
    if (matches.length > 1) {
      // Two-plus sibling accounts on this email happen to share this exact password - can't tell
      // them apart safely, so ask for the one identifier that's guaranteed unique.
      return res.status(409).json({ error: 'More than one account matches. Please sign in with your username instead.' });
    }
    const row = matches[0];

    if (!row.isActive) {
      return res.status(403).json({ error: 'Unable to login, please contact KuISOKO for help.' });
    }

    // Correct password, but not signed in yet - the account still needs to prove it received the
    // emailed code before a real session token is issued. The pendingToken is the only thing the
    // client gets back; it carries no role and is rejected by every authenticated route (see
    // verifyToken in lib/auth.ts), so it can't be used to skip this step.
    // Admins go through this every login regardless of their own toggle - an admin account is the
    // highest-value target, so a stolen password alone must never be enough to reach /admin.
    if (row.twoFactorEnabled || row.role === 'admin') {
      await issueTwoFactorCode(row.id, row.email, row.name);
      const pendingToken = signTwoFactorPendingToken(String(row.id));
      return res.json({ requiresTwoFactor: true, pendingToken, email: row.email });
    }

    const { password_hash, ...user } = row;
    const token = signToken({ sub: user.id, role: user.role });
    await linkGuestOrders(user.id, user.email);
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
      // First successful code for an admin who hadn't opted in yet - this proves they can
      // receive it, so turn 2FA on for good rather than asking again every future login.
      await client.query(
        `UPDATE users SET two_factor_enabled = true WHERE id = $1 AND role = 'admin' AND two_factor_enabled = false`,
        [userId]
      );

      const userResult = await client.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
      return userResult.rows[0];
    });
    const token = signToken({ sub: user.id, role: user.role });
    await linkGuestOrders(user.id, user.email);
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
  if (req.authUser!.role === 'admin') {
    return res.status(403).json({ error: 'Two-factor authentication is required for admin accounts and cannot be disabled.' });
  }
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
  username: usernameSchema,
});

// POST /api/auth/forgot-password - looks up the account by username (an email can now back
// several accounts, so it's no longer a safe way to find "the" account) and previews which inbox
// a reset link would go to, without sending anything yet. Lets the user confirm it's the right
// account - and see which of their several accounts they're about to recover - before an email
// goes out.
router.post('/forgot-password', forgotPasswordLookupLimiter, async (req, res, next) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(`SELECT email FROM users WHERE username = $1`, [parsed.data.username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No account found with that username.' });
    }
    return res.json({ maskedEmail: maskEmail(user.email) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/forgot-password/confirm - actually sends the reset link, once the client has
// shown the user which inbox it's going to (via the lookup above) and they've confirmed. The
// token is scoped to this specific user_id, so even if sibling accounts share the same email,
// only the account behind this username can ever be reset by it.
router.post('/forgot-password/confirm', forgotPasswordLimiter, async (req, res, next) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const userResult = await pool.query(`SELECT id, name, email FROM users WHERE username = $1`, [parsed.data.username]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No account found with that username.' });
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [user.id, tokenHash]
    );
    const resetUrl = `${getAppUrl()}/reset-password?token=${rawToken}`;
    sendPasswordResetEmail(user.email, user.name, resetUrl); // fire-and-forget
    return res.json({ message: 'A password reset link has been sent to your email.' });
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
