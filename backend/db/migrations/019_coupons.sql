-- Coupon/promo code system: admin-managed codes, applied at checkout, tracked on the order.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/019_coupons.sql

BEGIN;

CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE, -- stored uppercase, e.g. 'SAVE20'
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value    NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  usage_limit       INT CHECK (usage_limit IS NULL OR usage_limit > 0), -- NULL = unlimited
  usage_count       INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  expires_at        TIMESTAMPTZ, -- NULL = no expiry
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

COMMIT;
