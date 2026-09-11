-- Lets the app tell "actively sharing" apart from "went quiet" - a rider's last known position
-- stays on file either way, but the customer's map (and the admin) should know whether it's live
-- or stale. Also gives the admin a notification when a rider stops sharing before their order is
-- actually delivered, so a paused/stopped delivery in progress doesn't go unnoticed.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/033_rider_stop_sharing.sql

BEGIN;

ALTER TABLE rider_locations ADD COLUMN sharing_active BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders ADD COLUMN rider_stop_alert_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN rider_stop_alert_unread BOOLEAN NOT NULL DEFAULT false;

COMMIT;
