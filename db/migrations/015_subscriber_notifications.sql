-- Adds an unread flag to newsletter_subscribers so new "inner circle" signups show up
-- in the admin notification bell, same pattern as users/reviews/orders.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/015_subscriber_notifications.sql

BEGIN;

ALTER TABLE newsletter_subscribers ADD COLUMN is_unread BOOLEAN NOT NULL DEFAULT true;

COMMIT;
