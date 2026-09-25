import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { paypackRequestLimiter } from '../middleware/rateLimit.js';
import {
  cashin,
  findTransaction,
  normalizeRwandaLocalPhone,
  normalizePaypackStatus,
  verifyWebhookSignature,
  isPaypackConfigured,
  type PaypackStatus,
} from '../lib/paypack.js';
import { settleTopup } from './wallet.js';

const router = Router();

const requestSchema = z.object({
  orderId: z.string().uuid(),
  phoneNumber: z.string().trim().min(9, 'A valid phone number is required'),
});

async function settleTransaction(txId: string, orderId: string, status: 'SUCCESSFUL' | 'FAILED') {
  await withTransaction(async (client) => {
    await client.query(`UPDATE paypack_transactions SET status = $1 WHERE id = $2`, [status, txId]);
    if (status === 'SUCCESSFUL') {
      await client.query(`UPDATE orders SET payment_status = 'paid', payment_method = 'Paypack' WHERE id = $1`, [orderId]);
    } else {
      await client.query(`UPDATE orders SET payment_status = 'failed' WHERE id = $1`, [orderId]);
    }
  });
}

// POST /api/paypack/cashin - guest checkout allowed, mirroring guest order creation.
// Triggers the Paypack cashin prompt on the customer's phone for the order's total. Response shape
// mirrors /api/momo/request-to-pay (`referenceId`) so the frontend can share one payment flow.
router.post('/cashin', paypackRequestLimiter, optionalAuthenticate, async (req, res, next) => {
  if (!isPaypackConfigured()) {
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

    const phoneNumber = normalizeRwandaLocalPhone(parsed.data.phoneNumber);
    const { ref } = await cashin({ amount: Number(order.total), phoneNumber });

    await pool.query(
      `INSERT INTO paypack_transactions (ref, order_id, phone_number, amount, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [ref, order.id, phoneNumber, order.total]
    );

    return res.status(202).json({ referenceId: ref });
  } catch (err) {
    return next(err);
  }
});

// GET /api/paypack/status/:ref - poll for approval status; marks the order paid/failed once
// resolved. Also settled instantly by the webhook below when Paypack reaches us first.
router.get('/status/:ref', optionalAuthenticate, async (req, res, next) => {
  try {
    const txResult = await pool.query(
      `SELECT id, order_id AS "orderId", status FROM paypack_transactions WHERE ref = $1`,
      [req.params.ref]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });

    if (tx.status !== 'PENDING') {
      return res.json({ status: tx.status });
    }

    const { status } = await findTransaction(req.params.ref);
    if (status === 'SUCCESSFUL' || status === 'FAILED') {
      await settleTransaction(tx.id, tx.orderId, status);
    }
    return res.json({ status });
  } catch (err) {
    return next(err);
  }
});

// POST /api/paypack/webhook - Paypack pushes a `transaction:processed` event here once a cashin
// resolves, so paid orders settle immediately instead of waiting on the next poll. Public by
// necessity (Paypack calls it directly), but every request is verified against the
// `x-paypack-signature` header before anything is trusted - see verifyWebhookSignature().
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.header('x-paypack-signature');
    if (!verifyWebhookSignature(req.rawBody ?? Buffer.alloc(0), signature)) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    const event = req.body as { data?: { ref?: string; status?: string } };
    const ref = event.data?.ref;
    const rawStatus = event.data?.status;
    if (!ref || !rawStatus) return res.status(200).json({ ok: true }); // nothing actionable, ack anyway

    const status: PaypackStatus = normalizePaypackStatus(rawStatus);

    const txResult = await pool.query(
      `SELECT id, order_id AS "orderId", status FROM paypack_transactions WHERE ref = $1`,
      [ref]
    );
    const tx = txResult.rows[0];
    if (tx) {
      if (tx.status === 'PENDING' && (status === 'SUCCESSFUL' || status === 'FAILED')) {
        await settleTransaction(tx.id, tx.orderId, status);
      }
      return res.status(200).json({ ok: true });
    }

    // Not an order payment - check whether it's a wallet top-up instead (same ref space, resolved
    // by Paypack's cashin call, but wallet_topups is keyed by user_id rather than order_id).
    const topupResult = await pool.query(
      `SELECT id, user_id AS "userId", amount, status FROM wallet_topups WHERE reference = $1`,
      [ref]
    );
    const topup = topupResult.rows[0];
    if (topup && topup.status === 'PENDING' && (status === 'SUCCESSFUL' || status === 'FAILED')) {
      await settleTopup(topup.id, topup.userId, Number(topup.amount), status);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
