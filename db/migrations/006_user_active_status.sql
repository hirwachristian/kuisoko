-- Adds an admin-controlled active/inactive flag; deactivated users are blocked at login.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/006_user_active_status.sql

BEGIN;

ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

COMMIT;
