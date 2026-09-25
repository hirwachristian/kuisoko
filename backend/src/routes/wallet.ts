import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import { pool, withTransaction } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { walletTopupLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../lib/httpError.js';
import { adjustBalance } from '../lib/wallet.js';
import { requestToPay, getTransactionStatus, normalizeRwandaMsisdn, isMomoConfigured } from '../lib/momo.js';
import { cashin, findTransaction, normalizeRwandaLocalPhone, isPaypackConfigured } from '../lib/paypack.js';

const router = Router();

// GET /api/wallet - the balance card's numbers. balance is always the live users.balance value;
// pendingDeposits/lifetimeTopups are derived from the ledger tables rather than cached anywhere,
// so they can never drift out of sync with it.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const [balanceResult, pendingResult, lifetimeResult] = await Promise.all([
      pool.query(`SELECT balance FROM users WHERE id = $1`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_topups WHERE user_id = $1 AND status = 'PENDING'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_transactions WHERE user_id = $1 AND type = 'topup'`, [userId]),
    ]);
    if (balanceResult.rowCount === 0) return res.status(404).json({ error: 'Account not found.' });
    return res.json({
      balance: Number(balanceResult.rows[0].balance),
      pendingDeposits: Number(pendingResult.rows[0].total),
      lifetimeTopups: Number(lifetimeResult.rows[0].total),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/wallet/transactions - full ledger for this user, newest first. Returned whole (not
// server-paginated) - every other list in this app (admin product/order tables, etc.) is
// paginated client-side over a fully-fetched array, and a single customer's wallet history is
// never large enough for that to matter.
router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, type, amount, balance_after AS "balanceAfter", reference, description, created_at AS "createdAt"
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.authUser!.id]
    );
    return res.json({ transactions: result.rows });
  } catch (err) {
    return next(err);
  }
});

// GET /api/wallet/transactions/export - the "Download Statement" button. Mirrors
// GET /api/products/export/csv's shape/conventions exactly.
router.get('/transactions/export', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT type, amount, balance_after AS "balanceAfter", description, created_at AS "createdAt"
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.authUser!.id]
    );
    const rows = result.rows.map((r) => ({
      date: new Date(r.createdAt).toISOString(),
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      description: r.description,
    }));
    const csv = stringifyCsv(rows, { header: true, columns: ['date', 'type', 'amount', 'balanceAfter', 'description'] });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="kuisoko-wallet-statement.csv"');
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
});

const topupSchema = z.object({
  phoneNumber: z.string().trim().min(9, 'A valid phone number is required'),
  amount: z.number().positive().min(100, 'Minimum top-up is Rwf 100'),
});

// POST /api/wallet/topup/momo - triggers the real MTN MoMo approval prompt on the customer's own
// phone. Response shape mirrors /api/momo/request-to-pay (`referenceId`) so the frontend can reuse
// the exact same poll-for-approval flow already built for checkout.
router.post('/topup/momo', walletTopupLimiter, authenticate, async (req, res, next) => {
  if (!isMomoConfigured()) {
    return res.status(503).json({ error: 'Mobile money payment is not configured on this server yet.' });
  }
  const parsed = topupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const phoneNumber = normalizeRwandaMsisdn(parsed.data.phoneNumber);
    const { referenceId } = await requestToPay({
      amount: parsed.data.amount,
      phoneNumber,
      externalId: crypto.randomUUID(),
      payerMessage: 'KuISOKO wallet top-up',
      payeeNote: 'KuISOKO wallet top-up',
    });

    await pool.query(
      `INSERT INTO wallet_topups (user_id, provider, reference, phone_number, amount, status)
       VALUES ($1, 'momo', $2, $3, $4, 'PENDING')`,
      [req.authUser!.id, referenceId, phoneNumber, parsed.data.amount]
    );

    return res.status(202).json({ referenceId });
  } catch (err) {
    return next(err);
  }
});

// POST /api/wallet/topup/paypack - same shape, via Paypack (covers Airtel Money too).
router.post('/topup/paypack', walletTopupLimiter, authenticate, async (req, res, next) => {
  if (!isPaypackConfigured()) {
    return res.status(503).json({ error: 'Mobile money payment is not configured on this server yet.' });
  }
  const parsed = topupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const phoneNumber = normalizeRwandaLocalPhone(parsed.data.phoneNumber);
    const { ref } = await cashin({ amount: parsed.data.amount, phoneNumber });

    await pool.query(
      `INSERT INTO wallet_topups (user_id, provider, reference, phone_number, amount, status)
       VALUES ($1, 'paypack', $2, $3, $4, 'PENDING')`,
      [req.authUser!.id, ref, phoneNumber, parsed.data.amount]
    );

    return res.status(202).json({ referenceId: ref });
  } catch (err) {
    return next(err);
  }
});

async function settleTopup(topupId: string, userId: string, amount: number, status: 'SUCCESSFUL' | 'FAILED', reason?: string) {
  await withTransaction(async (client) => {
    await client.query(`UPDATE wallet_topups SET status = $1, reason = $2 WHERE id = $3`, [status, reason ?? null, topupId]);
    if (status === 'SUCCESSFUL') {
      await adjustBalance(client, userId, amount, { type: 'topup', reference: topupId, description: 'Wallet top-up' });
    }
  });
}

// GET /api/wallet/topup/status/:reference - poll for approval status, credits the balance once
// resolved. Handles both providers - the reference format doesn't overlap between them (MTN's is
// a UUID it generates itself, Paypack's own `ref` format is different), and the row already
// records which provider issued it.
router.get('/topup/status/:reference', authenticate, async (req, res, next) => {
  try {
    const txResult = await pool.query(
      `SELECT id, user_id AS "userId", provider, amount, status FROM wallet_topups WHERE reference = $1`,
      [req.params.reference]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Top-up not found.' });
    if (tx.userId !== req.authUser!.id) return res.status(403).json({ error: 'You do not have access to this top-up.' });

    if (tx.status !== 'PENDING') {
      return res.json({ status: tx.status });
    }

    if (tx.provider === 'momo') {
      const { status, reason } = await getTransactionStatus(req.params.reference);
      if (status !== 'PENDING') await settleTopup(tx.id, tx.userId, Number(tx.amount), status, reason);
      return res.json({ status, reason });
    } else {
      const { status } = await findTransaction(req.params.reference);
      if (status === 'SUCCESSFUL' || status === 'FAILED') await settleTopup(tx.id, tx.userId, Number(tx.amount), status);
      return res.json({ status });
    }
  } catch (err) {
    return next(err);
  }
});

export { settleTopup };
export default router;
