-- Adds the table backing the admin NotificationPanel's "delete" (hide) action.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/004_dismissed_notifications.sql

BEGIN;

CREATE TABLE dismissed_notifications (
  notification_id  TEXT PRIMARY KEY, -- e.g. 'order-<uuid>' or 'user-<id>'
  dismissed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
