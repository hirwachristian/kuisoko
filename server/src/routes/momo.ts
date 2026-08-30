import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { requestToPay, getTransactionStatus, normalizeRwandaMsisdn, isMomoConfigured } from '../lib/momo.js';

const router = Router();

const requestSchema = z.object({
  orderId: z.string().uuid(),
  phoneNumber: z.string().trim().min(9, 'A valid phone number is required'),
});

// POST /api/momo/request-to-pay - guest checkout allowed, mirroring guest order creation.
// Triggers the MTN MoMo approval prompt on the customer's phone for the order's total.
router.post('/request-to-pay', optionalAuthenticate, async (req, res, next) => {
  if (!isMomoConfigured()) {
    return res.status(503).json({ error: 'Mobile money payment is not configured on this server yet.' });
  }
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const orderResult = await pool.query(`SELECT id, total, payment_status FROM orders WHERE id = $1`, [parsed.data.orderId]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.payment_status === 'paid') return res.status(409).json({ error: 'This order has already been paid.' });

    const phoneNumber = normalizeRwandaMsisdn(parsed.data.phoneNumber);
    const { referenceId } = await requestToPay({
      amount: Number(order.total),
      phoneNumber,
      externalId: order.id,
      payerMessage: 'KuISOKO order payment',
      payeeNote: `Order ${order.id}`,
    });

    await pool.query(
      `INSERT INTO momo_transactions (reference_id, order_id, phone_number, amount, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [referenceId, order.id, phoneNumber, order.total]
    );

    return res.status(202).json({ referenceId });
  } catch (err) {
    return next(err);
  }
});

// GET /api/momo/status/:referenceId - poll for approval status; marks the order paid/failed once resolved.
router.get('/status/:referenceId', optionalAuthenticate, async (req, res, next) => {
  try {
    const txResult = await pool.query(
      `SELECT id, order_id AS "orderId", status FROM momo_transactions WHERE reference_id = $1`,
      [req.params.referenceId]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });

    if (tx.status !== 'PENDING') {
      return res.json({ status: tx.status });
    }

    const { status, reason } = await getTransactionStatus(req.params.referenceId);
    if (status !== 'PENDING') {
      await withTransaction(async (client) => {
        await client.query(`UPDATE momo_transactions SET status = $1, reason = $2 WHERE id = $3`, [status, reason ?? null, tx.id]);
        if (status === 'SUCCESSFUL') {
          await client.query(`UPDATE orders SET payment_status = 'paid', payment_method = 'MTN Mobile Money' WHERE id = $1`, [tx.orderId]);
        } else {
          await client.query(`UPDATE orders SET payment_status = 'failed' WHERE id = $1`, [tx.orderId]);
        }
      });
    }
    return res.json({ status, reason });
  } catch (err) {
    return next(err);
  }
});

export default router;
