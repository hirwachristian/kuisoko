import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/newsletter - admin: every active subscriber, for the notification feed
router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, subscribed_at AS "subscribedAt", is_unread AS "unread"
       FROM newsletter_subscribers WHERE is_active = true ORDER BY subscribed_at DESC`
    );
    return res.json({ subscribers: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/newsletter/status - authenticated: is the current account subscribed?
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT is_active AS "isActive" FROM newsletter_subscribers WHERE user_id = $1`,
      [req.authUser!.id]
    );
    return res.json({ subscribed: result.rows[0]?.isActive ?? false });
  } catch (err) {
    return next(err);
  }
});

// POST /api/newsletter/subscribe - "Join our inner circle" - requires a signed-in account;
// always uses the account's own email, so there's no free-text email spoofing.
router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.authUser!.id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'Account not found.' });
    const email = userResult.rows[0].email;

    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (email, user_id)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET is_active = true, unsubscribed_at = NULL, is_unread = true
       RETURNING id, email, is_active AS "isActive", subscribed_at AS "subscribedAt"`,
      [email, req.authUser!.id]
    );
    return res.status(201).json({ subscriber: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

const unsubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

// POST /api/newsletter/unsubscribe - public (reached from the unsubscribe link in emails, no login required)
router.post('/unsubscribe', async (req, res, next) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await pool.query(
      `UPDATE newsletter_subscribers SET is_active = false, unsubscribed_at = now() WHERE email = $1`,
      [parsed.data.email]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Subscriber not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/newsletter/:id/read - admin: mark a new-subscriber notification as read
router.patch('/:id/read', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE newsletter_subscribers SET is_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Subscriber not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
