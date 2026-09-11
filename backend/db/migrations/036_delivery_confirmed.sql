-- Records when a rider's code verification actually completes a delivery, so the admin gets a
-- proper "delivered successfully" notification (distinct from just watching the status change),
-- and so the rider has something to look back on as delivery history.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/036_delivery_confirmed.sql

BEGIN;

ALTER TABLE orders ADD COLUMN delivery_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivery_confirmed_unread BOOLEAN NOT NULL DEFAULT false;

COMMIT;
