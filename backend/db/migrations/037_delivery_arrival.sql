-- Set once the rider's live GPS position comes within range of the (geocoded) delivery address -
-- real distance from real coordinates, not a timer or a guess - so the customer can be told to
-- get ready before the rider actually knocks.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/037_delivery_arrival.sql

BEGIN;

ALTER TABLE orders ADD COLUMN arrival_notified_at TIMESTAMPTZ;

COMMIT;
