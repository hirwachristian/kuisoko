import type { PoolClient } from 'pg';
import { HttpError } from './httpError.js';

// A payment method is treated as the wallet when its admin-configured name mentions "wallet" -
// mirrors isMomoMethodName/isPaypackMethodName in frontend/pages/CartCheckout.tsx.
export const isWalletMethodName = (name: string) => /wallet/i.test(name);

/** Adjusts a user's wallet balance and appends a ledger row, atomically. Must be called with a
 * client already inside withTransaction() - locks the user row first so two concurrent
 * spends/refunds/topups on the same account can never race each other into an inconsistent
 * balance. Throws (rolling back the whole transaction) if a negative `delta` would take the
 * balance below zero - insufficient funds are a hard stop, never an overdraft. */
export async function adjustBalance(
  client: PoolClient,
  userId: string,
  delta: number,
  entry: { type: 'topup' | 'purchase' | 'refund'; reference?: string; description: string }
): Promise<number> {
  const locked = await client.query(`SELECT balance FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  if (locked.rowCount === 0) throw new HttpError(404, 'Account not found.');
  const next = Math.round((Number(locked.rows[0].balance) + delta) * 100) / 100;
  if (next < 0) throw new HttpError(402, 'Insufficient wallet balance.');

  await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [next, userId]);
  await client.query(
    `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference, description)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, entry.type, Math.abs(delta), next, entry.reference ?? null, entry.description]
  );
  return next;
}

/** Refunds a cancelled/returned order's total back to the customer's wallet, if (and only if) it
 * was actually paid via the wallet - a no-op for every other payment method, and guarded by
 * wallet_refunded_at (mirrors restoreOrderStock's stock_restored_at guard) so a second Cancelled/
 * Returned transition on the same order never double-refunds it. */
export async function refundWalletIfNeeded(client: PoolClient, orderId: string): Promise<void> {
  const locked = await client.query(
    `SELECT user_id AS "userId", total, order_number AS "orderNumber", payment_method AS "paymentMethod", payment_status AS "paymentStatus", wallet_refunded_at AS "walletRefundedAt"
     FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (locked.rowCount === 0) return;
  const order = locked.rows[0];
  if (order.walletRefundedAt) return;
  if (order.paymentStatus !== 'paid' || !order.paymentMethod || !isWalletMethodName(order.paymentMethod)) return;
  if (!order.userId) return; // shouldn't happen - wallet payment requires an account - but never crash a status update over it

  await adjustBalance(client, order.userId, Number(order.total), {
    type: 'refund',
    reference: orderId,
    description: `Refund for order #KS-${order.orderNumber}`,
  });
  await client.query(`UPDATE orders SET wallet_refunded_at = now() WHERE id = $1`, [orderId]);
}
