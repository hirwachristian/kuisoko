import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { deliveryAddressSchema, insertOrder, fetchOrderById } from './orders.js';

const router = Router();

// Fixed for now rather than admin-configurable - keeps the first version shippable. Snapshotted
// onto each group_orders row at creation time, so a later change here never rewrites the terms of
// a group that's already collecting participants.
const GROUP_BUY_CONFIG = {
  maxParticipants: 4,
  tiers: [
    { minParticipants: 2, discountPercent: 10 },
    { minParticipants: 4, discountPercent: 20 },
  ],
  expiryHours: 48,
};

function bestDiscountForCount(tiers: { minParticipants: number; discountPercent: number }[], count: number): number {
  return tiers.reduce((max, t) => (t.minParticipants <= count && t.discountPercent > max ? t.discountPercent : max), 0);
}

// Recomputes every participant's order to match the discount their final headcount unlocked, and
// closes the group - called the moment a join hits the cap, or lazily the next time anyone reads a
// group past its expiry (there's no job scheduler in this app to do it proactively). No payment to
// reverse either way: checkout here is Cash on Delivery/manually-confirmed Mobile Money, so this is
// just a total recalculated before dispatch, never a refund.
async function finalizeIfDue(
  client: PoolClient,
  group: { id: string; max_participants: number; tiers: { minParticipants: number; discountPercent: number }[]; expires_at: string | Date; status: string },
  participantCount: number
): Promise<string> {
  if (group.status !== 'open') return group.status;
  const isFull = participantCount >= group.max_participants;
  const isExpired = new Date(group.expires_at).getTime() <= Date.now();
  if (!isFull && !isExpired) return 'open';

  const discountPercent = bestDiscountForCount(group.tiers, participantCount);
  await client.query(
    `UPDATE orders SET
       discount_amount = ROUND(subtotal * $1 / 100, 2),
       total = GREATEST(subtotal + shipping_fee - ROUND(subtotal * $1 / 100, 2), 0)
     WHERE group_order_id = $2`,
    [discountPercent, group.id]
  );
  const newStatus = isFull ? 'full' : 'expired';
  await client.query(`UPDATE group_orders SET status = $1 WHERE id = $2`, [newStatus, group.id]);
  return newStatus;
}

const paymentMethodSchema = z.string().trim().optional().refine(
  (v) => v !== 'WhatsApp',
  { message: 'WhatsApp checkout is not available for group orders.' }
);

const groupOrderCreateSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  customerName: z.string().trim().min(1, 'Customer name is required'),
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: paymentMethodSchema,
});

// POST /api/group-orders - starts a new group for a product and immediately places the starter's
// own order as its first participant (at whatever tier 1 participant unlocks - none, by default).
router.post('/', optionalAuthenticate, async (req, res, next) => {
  const parsed = groupOrderCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const productResult = await client.query(
        `SELECT id, name, group_buy_enabled AS "groupBuyEnabled" FROM products WHERE id = $1`,
        [data.productId]
      );
      if (productResult.rowCount === 0) throw new HttpError(404, 'Product not found.');
      const product = productResult.rows[0];
      if (!product.groupBuyEnabled) throw new HttpError(400, 'Group buying is not available for this product.');

      let code = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = crypto.randomBytes(4).toString('hex');
        const exists = await client.query(`SELECT 1 FROM group_orders WHERE code = $1`, [candidate]);
        if (exists.rowCount === 0) { code = candidate; break; }
      }
      if (!code) throw new HttpError(500, 'Could not generate a group code, please try again.');

      const groupResult = await client.query(
        `INSERT INTO group_orders (code, product_id, max_participants, tiers, expires_at)
         VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
         RETURNING id, code`,
        [code, product.id, GROUP_BUY_CONFIG.maxParticipants, JSON.stringify(GROUP_BUY_CONFIG.tiers), GROUP_BUY_CONFIG.expiryHours]
      );
      const groupOrderId = groupResult.rows[0].id;

      const orderId = await insertOrder(
        client,
        {
          customerName: data.customerName,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          items: [{ productId: product.id, name: product.name, price: 0, quantity: data.quantity }],
        },
        req.authUser?.id ?? null,
        { groupOrderId }
      );

      return { code: groupResult.rows[0].code, orderId };
    });

    return res.status(201).json({ code: result.code, order: await fetchOrderById(result.orderId) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

// GET /api/group-orders/:code - public, no auth: the landing page anyone with the link opens.
router.get('/:code', async (req, res, next) => {
  try {
    const groupResult = await pool.query(
      `SELECT g.id, g.code, g.max_participants AS "maxParticipants", g.tiers, g.status, g.expires_at AS "expiresAt",
              p.id AS "productId", p.name AS "productName", p.images[1] AS "productImage",
              p.price AS "productPrice", p.discount AS "productDiscount"
       FROM group_orders g JOIN products p ON p.id = g.product_id
       WHERE g.code = $1`,
      [req.params.code]
    );
    if (groupResult.rowCount === 0) {
      return res.status(404).json({ error: 'Group order not found.' });
    }
    const group = groupResult.rows[0];

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE group_order_id = $1 AND status != 'Cancelled'`,
      [group.id]
    );
    const participantCount = countResult.rows[0].count;

    let status = group.status;
    if (status === 'open' && new Date(group.expiresAt).getTime() <= Date.now()) {
      status = await withTransaction((client) =>
        finalizeIfDue(client, { id: group.id, max_participants: group.maxParticipants, tiers: group.tiers, expires_at: group.expiresAt, status: group.status }, participantCount)
      );
    }

    return res.json({
      code: group.code,
      status,
      expiresAt: group.expiresAt,
      maxParticipants: group.maxParticipants,
      tiers: group.tiers,
      participantCount,
      currentDiscountPercent: bestDiscountForCount(group.tiers, participantCount),
      product: { id: group.productId, name: group.productName, image: group.productImage, price: Number(group.productPrice), discount: group.productDiscount != null ? Number(group.productDiscount) : 0 },
    });
  } catch (err) {
    return next(err);
  }
});

const groupOrderJoinSchema = z.object({
  quantity: z.number().int().positive().default(1),
  customerName: z.string().trim().min(1, 'Customer name is required'),
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: paymentMethodSchema,
});

// POST /api/group-orders/:code/join - adds a new participant's own order to an open group.
router.post('/:code/join', optionalAuthenticate, async (req, res, next) => {
  const parsed = groupOrderJoinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    const orderId = await withTransaction(async (client) => {
      // Lock the group row so two people joining at the same instant can't both slip past the cap.
      const groupResult = await client.query(
        `SELECT id, product_id AS "productId", max_participants AS "maxParticipants", tiers, status, expires_at AS "expiresAt"
         FROM group_orders WHERE code = $1 FOR UPDATE`,
        [req.params.code]
      );
      if (groupResult.rowCount === 0) throw new HttpError(404, 'Group order not found.');
      const group = groupResult.rows[0];

      const countResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM orders WHERE group_order_id = $1 AND status != 'Cancelled'`,
        [group.id]
      );
      const countBefore = countResult.rows[0].count;
      const isExpired = new Date(group.expiresAt).getTime() <= Date.now();

      if (group.status !== 'open' || isExpired || countBefore >= group.maxParticipants) {
        if (group.status === 'open') {
          await finalizeIfDue(client, { id: group.id, max_participants: group.maxParticipants, tiers: group.tiers, expires_at: group.expiresAt, status: group.status }, countBefore);
        }
        throw new HttpError(409, countBefore >= group.maxParticipants ? 'This group order is already full.' : 'This group order has ended.');
      }

      const productResult = await client.query(`SELECT id, name FROM products WHERE id = $1`, [group.productId]);
      const product = productResult.rows[0];

      const newCount = countBefore + 1;
      const discountPercent = bestDiscountForCount(group.tiers, newCount);

      const orderId = await insertOrder(
        client,
        {
          customerName: data.customerName,
          deliveryAddress: data.deliveryAddress,
          paymentMethod: data.paymentMethod,
          items: [{ productId: product.id, name: product.name, price: 0, quantity: data.quantity }],
        },
        req.authUser?.id ?? null,
        { groupOrderId: group.id, groupDiscountPercent: discountPercent }
      );

      // Hitting the cap right now closes the group immediately and locks this tier in for everyone
      // who joined earlier at a lower one, instead of leaving them to wait out the timer.
      if (newCount >= group.maxParticipants) {
        await finalizeIfDue(client, { id: group.id, max_participants: group.maxParticipants, tiers: group.tiers, expires_at: group.expiresAt, status: group.status }, newCount);
      }

      return orderId;
    });

    return res.status(201).json({ order: await fetchOrderById(orderId) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

export default router;
