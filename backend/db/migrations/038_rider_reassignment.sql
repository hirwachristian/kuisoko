-- Tracks when an order gets handed from one rider to another (not a first assignment, not a
-- plain unassignment) so the outgoing rider can be told it's no longer theirs and the customer can
-- be told who has it now.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/038_rider_reassignment.sql

BEGIN;

ALTER TABLE orders ADD COLUMN previous_rider_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN rider_reassigned_at TIMESTAMPTZ;

COMMIT;
