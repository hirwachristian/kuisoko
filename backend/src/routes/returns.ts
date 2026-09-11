import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { checkAndNotifyRestock } from './products.js';
import { restoreOrderStock } from './orders.js';

const router = Router();

const RETURN_COLUMNS = `
  rr.id, rr.order_id AS "orderId", 'KS-' || o.order_number AS "orderNumber", o.customer_name AS "customerName",
  o.customer_email AS "customerEmail", o.total, o.currency,
  rr.reason, rr.status, rr.admin_note AS "adminNote",
  rr.requested_at AS "requestedAt", rr.resolved_at AS "resolvedAt", rr.is_unread AS "unread"
`;

const createReturnSchema = z.object({
  orderId: z.string().uuid('A valid order is required.'),
  reason: z.string().trim().min(1, 'A reason is required.').max(1000),
});

// POST /api/returns - authenticated: a customer requests a return on one of their own Delivered
// orders. Only Delivered orders are eligible - matches the standard e-commerce assumption that a
// return is about an item you actually received, not one still in transit or already cancelled.
router.post('/', authenticate, async (req, res, next) => {
  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const orderResult = await pool.query(`SELECT user_id AS "userId", status FROM orders WHERE id = $1`, [parsed.data.orderId]);
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderResult.rows[0];
    if (req.authUser!.role !== 'admin' && String(order.userId) !== String(req.authUser!.id)) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }
    if (order.status !== 'Delivered') {
      return res.status(400).json({ error: 'Only delivered orders can be returned.' });
    }

    const result = await pool.query(
      `INSERT INTO return_requests (order_id, reason) VALUES ($1, $2) RETURNING id`,
      [parsed.data.orderId, parsed.data.reason]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A return request for this order is already pending or was already approved.' });
    }
    return next(err);
  }
});

// PATCH /api/returns/:id/acknowledge - authenticated: the order's owner dismisses the "your return
// was approved/rejected" flag once they've seen the resolution - not admin-gated, unlike everything
// below, since this belongs to the customer who filed the request.
router.patch('/:id/acknowledge', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE return_requests rr SET customer_unread = false
       FROM orders o WHERE rr.order_id = o.id AND rr.id = $1 AND o.user_id = $2`,
      [req.params.id, req.authUser!.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Return request not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

router.use(authenticate, requireAdmin);

// GET /api/returns - admin: every return request, newest first
router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${RETURN_COLUMNS} FROM return_requests rr JOIN orders o ON o.id = rr.order_id ORDER BY rr.requested_at DESC`
    );
    return res.json({ returnRequests: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/returns/unread-count - admin: badge count for the notification bell
router.get('/unread-count', async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM return_requests WHERE is_unread = true`);
    return res.json({ count: result.rows[0].count });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/returns/:id/read - admin: dismiss the "new return request" notification without
// resolving it (matches the same pattern as orders' own /:id/read)
router.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE return_requests SET is_unread = false WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Return request not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

async function fetchReturnRequest(id: string) {
  const result = await pool.query(`SELECT ${RETURN_COLUMNS} FROM return_requests rr JOIN orders o ON o.id = rr.order_id WHERE rr.id = $1`, [id]);
  return result.rows[0] ?? null;
}

// POST /api/returns/:id/approve - admin: approve a pending request - marks the order Returned,
// restores the stock it held (product + variant, same as a cancellation), and lets any pending
// back-in-stock signups fire if this pushes a product back above zero. There's no live payment
// gateway in this app to push real money back through, so this is the resolution itself, not a
// trigger for a separate refund step.
router.post('/:id/approve', async (req, res, next) => {
  try {
    const orderId = await withTransaction(async (client) => {
      const rrResult = await client.query(`SELECT order_id AS "orderId", status FROM return_requests WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (rrResult.rowCount === 0) throw new HttpError(404, 'Return request not found.');
      if (rrResult.rows[0].status !== 'pending') throw new HttpError(409, 'This request has already been resolved.');
      const orderId = rrResult.rows[0].orderId;

      await client.query(
        `UPDATE return_requests SET status = 'approved', resolved_at = now(), is_unread = false, customer_unread = true WHERE id = $1`,
        [req.params.id]
      );
      await client.query(`UPDATE orders SET status = 'Returned' WHERE id = $1`, [orderId]);
      await client.query(
        `INSERT INTO order_tracking_events (order_id, status, description) VALUES ($1, 'Returned', 'Return approved - order marked as returned')`,
        [orderId]
      );
      await restoreOrderStock(client, orderId);
      return orderId;
    });

    const itemsResult = await pool.query(`SELECT DISTINCT product_id FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL`, [orderId]);
    for (const row of itemsResult.rows) checkAndNotifyRestock(row.product_id);

    return res.json({ returnRequest: await fetchReturnRequest(req.params.id) });
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

const rejectSchema = z.object({
  note: z.string().trim().min(1, 'A reason for the customer is required.').max(1000),
});

// POST /api/returns/:id/reject - admin: reject with a reason shown back to the customer - no
// order or stock changes.
router.post('/:id/reject', async (req, res, next) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const result = await pool.query(
      `UPDATE return_requests SET status = 'rejected', admin_note = $1, resolved_at = now(), is_unread = false, customer_unread = true
       WHERE id = $2 AND status = 'pending' RETURNING id`,
      [parsed.data.note, req.params.id]
    );
    if (result.rowCount === 0) return res.status(409).json({ error: 'This request was not found or has already been resolved.' });

    return res.json({ returnRequest: await fetchReturnRequest(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

export default router;
