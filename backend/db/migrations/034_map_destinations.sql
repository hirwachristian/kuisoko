-- Lets the customer/rider map show the store's own location and the order's delivery address as
-- reference points, plus a "trace way" line between them. Store coordinates are a one-time admin
-- entry; delivery coordinates are geocoded lazily (best-effort, via Nominatim) and cached here so
-- an address is only ever looked up once.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/034_map_destinations.sql

BEGIN;

ALTER TABLE footer_settings ADD COLUMN store_lat DOUBLE PRECISION;
ALTER TABLE footer_settings ADD COLUMN store_lng DOUBLE PRECISION;

ALTER TABLE orders ADD COLUMN delivery_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN delivery_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN delivery_geocoded_at TIMESTAMPTZ;

COMMIT;
