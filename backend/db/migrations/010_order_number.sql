-- Adds a human-readable, sequential order number (displayed as KS-<order_number>,
-- e.g. KS-100000) alongside the internal UUID primary key, which stays unchanged
-- for foreign keys/URLs. Starts at 100000 so it's always exactly 6 digits.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/010_order_number.sql

BEGIN;

ALTER TABLE orders ADD COLUMN order_number BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 100000) UNIQUE;

COMMIT;
