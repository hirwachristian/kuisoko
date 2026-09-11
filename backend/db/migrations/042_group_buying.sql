-- "Guriza hamwe" (buy together) group orders: a customer starts a group for one product, shares
-- the link, and everyone who joins before it closes gets the discount tier their final headcount
-- unlocks. No payment/refund handling needed - checkout here is Cash on Delivery/manually-confirmed
-- Mobile Money, so a participant's order total is just updated in place before dispatch once the
-- group closes (by hitting its participant cap, or by its time window expiring), never a live charge
-- to walk back.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/042_group_buying.sql

BEGIN;

-- Admin opts specific products into group buying.
ALTER TABLE products ADD COLUMN group_buy_enabled BOOLEAN NOT NULL DEFAULT false;

-- One row per shareable group ("/group/:code"). max_participants and tiers are snapshotted from
-- the running config at creation time, so a later config change never rewrites an in-flight group's
-- terms out from under the people who already joined it expecting a specific deal.
CREATE TABLE group_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  max_participants INT NOT NULL,
  tiers            JSONB NOT NULL, -- [{ "minParticipants": 2, "discountPercent": 10 }, ...]
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'expired')),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_orders_code ON group_orders(code);

-- Each participant (including the one who started it) gets their own normal order, just tagged
-- with which group it belongs to - delivery, stock, and status all work exactly like any other
-- order; only the discount gets recomputed when the group closes.
ALTER TABLE orders ADD COLUMN group_order_id UUID REFERENCES group_orders(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_group_order_id ON orders(group_order_id);

COMMIT;
