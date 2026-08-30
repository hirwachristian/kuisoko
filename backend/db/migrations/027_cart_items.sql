-- Per-account cart persistence, mirroring the existing wishlists table. Previously the cart lived
-- only in frontend React state - it didn't survive a page refresh, let alone a logout/login, and
-- had no way to keep two accounts on the same device from seeing each other's items.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/027_cart_items.sql

BEGIN;

CREATE TABLE cart_items (
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity       INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selected_color TEXT,
  selected_size  TEXT,
  -- Variant-specific price override, if the line was added with a variant that has its own price;
  -- NULL means "use the product's current price" (kept live, not snapshotted).
  unit_price     NUMERIC(12,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

COMMIT;
