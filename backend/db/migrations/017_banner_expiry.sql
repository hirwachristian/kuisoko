-- Lets the admin set how long a site banner stays up; also drops visitor-side dismissal
-- (only the admin can turn a banner off now, from Business & Notifications).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/017_banner_expiry.sql

BEGIN;

ALTER TABLE site_announcement ADD COLUMN expires_at TIMESTAMPTZ;

COMMIT;
