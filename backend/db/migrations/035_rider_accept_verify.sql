-- Lets a rider explicitly accept one delivery at a time (rather than juggling every Shipped order
-- assigned to them simultaneously), and requires a customer-facing verification code - not a
-- self-serve button, not admin action - to actually complete it.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/035_rider_accept_verify.sql

BEGIN;

-- Set once a rider explicitly accepts this specific delivery. Only one Shipped order per rider
-- may have this set at a time - enforced in the accept endpoint, not the schema.
ALTER TABLE orders ADD COLUMN rider_accepted_at TIMESTAMPTZ;

-- 4-digit code generated the moment an order is marked Shipped, shown to the customer on their
-- tracking page, given verbally to the rider on drop-off. Plain text (not hashed like the 2FA
-- codes in auth.ts) because it needs to be re-displayed to the customer repeatedly, not delivered
-- once - a leak here means "someone could falsely confirm a delivery," not an account compromise.
ALTER TABLE orders ADD COLUMN delivery_verification_code TEXT;
ALTER TABLE orders ADD COLUMN delivery_verify_attempts INT NOT NULL DEFAULT 0;

COMMIT;
