-- Adds a customer email to orders so guest checkouts (no user account) can still receive
-- transactional emails (order confirmation, etc.) via Brevo.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/013_customer_email.sql

BEGIN;

ALTER TABLE orders ADD COLUMN customer_email TEXT;

COMMIT;
