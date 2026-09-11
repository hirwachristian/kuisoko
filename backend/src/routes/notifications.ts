import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/notifications/dismissed - ids hidden from the admin NotificationPanel
router.get('/dismissed', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT notification_id AS id FROM dismissed_notifications`);
    return res.json({ ids: result.rows.map((r) => r.id) });
  } catch (err) {
    return next(err);
  }
});

const dismissSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one notification id is required'),
});

// POST /api/notifications/dismissed - hide one or more notifications (single delete or bulk delete)
router.post('/dismissed', async (req, res, next) => {
  const parsed = dismissSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    await withTransaction(async (client) => {
      for (const id of parsed.data.ids) {
        await client.query(`INSERT INTO dismissed_notifications (notification_id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
      }
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// POST /api/notifications/mark-all-read - clears unread flags on all orders, users, reviews, and subscribers
router.post('/mark-all-read', async (_req, res, next) => {
  try {
    await withTransaction(async (client) => {
      await client.query(`UPDATE orders SET is_unread = false WHERE is_unread = true`);
      await client.query(`UPDATE orders SET rider_stop_alert_unread = false WHERE rider_stop_alert_unread = true`);
      await client.query(`UPDATE orders SET delivery_confirmed_unread = false WHERE delivery_confirmed_unread = true`);
      await client.query(`UPDATE users SET is_unread = false WHERE is_unread = true`);
      await client.query(`UPDATE reviews SET is_unread = false WHERE is_unread = true`);
      await client.query(`UPDATE newsletter_subscribers SET is_unread = false WHERE is_unread = true`);
      await client.query(`UPDATE return_requests SET is_unread = false WHERE is_unread = true`);
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
