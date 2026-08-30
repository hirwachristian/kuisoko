-- Adds the "Push Alerts" toggle (repurposed as: send discount/special announcements to
-- newsletter subscribers) to the singleton app_settings row.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/014_marketing_emails_setting.sql

BEGIN;

ALTER TABLE app_settings ADD COLUMN marketing_emails_enabled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
