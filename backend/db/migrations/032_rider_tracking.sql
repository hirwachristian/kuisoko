-- Lets the store assign one of its own delivery riders to a shipped order, have that rider share
-- their live position from their phone, and show it on a map on the customer's order page.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/032_rider_tracking.sql

-- Must run as its own statement, not inside the BEGIN/COMMIT below - Postgres won't allow a
-- freshly-added enum value to be used in the same transaction it was added in.
ALTER TYPE user_role ADD VALUE 'rider';

BEGIN;

ALTER TABLE orders ADD COLUMN rider_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_rider_id ON orders(rider_id);

-- One row per rider, upserted on every ping - we only ever need "where are they right now," not
-- a trail, so this stays small no matter how often a rider's phone pings while delivering.
CREATE TABLE rider_locations (
  rider_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
