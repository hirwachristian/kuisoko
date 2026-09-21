import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { couponValidateLimiter } from '../middleware/rateLimit.js';
import { validateCoupon } from '../lib/coupons.js';
import { HttpError } from '../lib/httpError.js';

const router = Router();

const COUPON_COLUMNS = `
  id, code, discount_type AS "discountType", discount_value AS "discountValue",
  min_order_amount AS "minOrderAmount", usage_limit AS "usageLimit", usage_count AS "usageCount",
  is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt"
`;

router.get('/', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${COUPON_COLUMNS} FROM coupons ORDER BY created_at DESC`);
    return res.json({ coupons: result.rows });
  } catch (err) {
    return next(err);
  }
});

const couponSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').transform((s) => s.toUpperCase()),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive('Discount value must be greater than 0'),
  minOrderAmount: z.number().nonnegative().default(0),
  usageLimit: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  if (data.discountType === 'percentage' && data.discountValue > 100) {
    return res.status(400).json({ error: 'A percentage discount cannot exceed 100.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COUPON_COLUMNS}`,
      [data.code, data.discountType, data.discountValue, data.minOrderAmount, data.usageLimit ?? null, data.expiresAt ?? null]
    );
    return res.status(201).json({ coupon: result.rows[0] });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return res.status(409).json({ error: `A coupon with code "${data.code}" already exists.` });
    }
    return next(err);
  }
});

// Not couponSchema.partial(): would still apply .default(0) on minOrderAmount for any
// omitted field (zod resolves defaults before the optional-wrapping applies), silently
// resetting it on updates that don't mention it.
const couponUpdateSchema = z.object({
  discountType: z.enum(['percentage', 'fixed']).optional(),
  discountValue: z.number().positive('Discount value must be greater than 0').optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  const parsed = couponUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  try {
    const result = await pool.query(
      `UPDATE coupons SET
         discount_type = COALESCE($1, discount_type),
         discount_value = COALESCE($2, discount_value),
         min_order_amount = COALESCE($3, min_order_amount),
         usage_limit = CASE WHEN $4::boolean THEN $5::int ELSE usage_limit END,
         expires_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE expires_at END,
         is_active = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING ${COUPON_COLUMNS}`,
      [
        data.discountType ?? null, data.discountValue ?? null, data.minOrderAmount ?? null,
        'usageLimit' in data, data.usageLimit ?? null,
        'expiresAt' in data, data.expiresAt ?? null,
        data.isActive ?? null, req.params.id,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Coupon not found.' });
    return res.json({ coupon: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`DELETE FROM coupons WHERE id = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Coupon not found.' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

const validateSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  subtotal: z.number().nonnegative(),
});

// POST /api/coupons/validate - public: preview a coupon's discount for the checkout page.
// Does not consume a usage slot - that only happens when the order is actually placed.
router.post('/validate', couponValidateLimiter, async (req, res, next) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const validation = await validateCoupon(parsed.data.code, parsed.data.subtotal);
    return res.json(validation);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    return next(err);
  }
});

export default router;
