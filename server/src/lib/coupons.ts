import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { HttpError } from './httpError.js';

export interface CouponValidation {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
}

/** Validates a coupon against the current subtotal and computes the resulting discount.
 * Single source of truth, used both by the public /coupons/validate preview endpoint and
 * by order creation - never trust a client-computed discount amount.
 *
 * Pass `client` (and it must be inside a transaction) when actually placing an order, so the
 * coupon row is locked (FOR UPDATE) - otherwise two concurrent orders could both slip past a
 * usage_limit check before either's usage_count increment lands. */
export async function validateCoupon(code: string, subtotal: number, client?: PoolClient): Promise<CouponValidation> {
  const runner = client ?? pool;
  const result = await runner.query(
    `SELECT id, code, discount_type AS "discountType", discount_value AS "discountValue",
            min_order_amount AS "minOrderAmount", usage_limit AS "usageLimit", usage_count AS "usageCount",
            is_active AS "isActive", expires_at AS "expiresAt"
     FROM coupons WHERE code = $1 ${client ? 'FOR UPDATE' : ''}`,
    [code.trim().toUpperCase()]
  );
  const coupon = result.rows[0];
  if (!coupon) throw new HttpError(404, 'Invalid coupon code.');
  if (!coupon.isActive) throw new HttpError(409, 'This coupon is no longer active.');
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()) throw new HttpError(409, 'This coupon has expired.');
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new HttpError(409, 'This coupon has reached its usage limit.');
  }
  if (subtotal < Number(coupon.minOrderAmount)) {
    throw new HttpError(409, `This coupon requires a minimum order of ${coupon.minOrderAmount}.`);
  }

  const discountValue = Number(coupon.discountValue);
  const discountAmount = coupon.discountType === 'percentage'
    ? Math.min(subtotal * (discountValue / 100), subtotal)
    : Math.min(discountValue, subtotal);

  return { id: coupon.id, code: coupon.code, discountType: coupon.discountType, discountValue, discountAmount };
}
