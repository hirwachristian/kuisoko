-- Lets a customer ask to be emailed when an out-of-stock product (or a specific out-of-stock
-- color/size) comes back. color/size use '' rather than NULL for "no variant" so the partial
-- unique index below can actually catch duplicate signups - Postgres treats every NULL as
-- distinct from every other NULL, which would let the same email sign up for the same product
-- endlessly.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/039_back_in_stock.sql

BEGIN;

CREATE TABLE back_in_stock_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color       TEXT NOT NULL DEFAULT '',
  size        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ
);

CREATE INDEX idx_back_in_stock_product ON back_in_stock_requests(product_id, color, size) WHERE notified_at IS NULL;

-- Only pending (not yet notified) signups need to be unique - once notified, the same person
-- should be able to sign up again for a future restock-then-sellout cycle.
CREATE UNIQUE INDEX idx_back_in_stock_unique_pending ON back_in_stock_requests(product_id, color, size, lower(email)) WHERE notified_at IS NULL;

COMMIT;
