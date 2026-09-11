-- Email-based verification required before a customer can complete a WhatsApp checkout - proves
-- they actually control the email on the order before handing them off to send it via WhatsApp.
-- Guest checkouts have no user_id to hang this on, so it's keyed on the email itself, same shape
-- as the other one-time-code tables (two_factor_codes, password_reset_tokens).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/041_checkout_verification_codes.sql

BEGIN;

CREATE TABLE checkout_verification_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkout_verification_codes_email ON checkout_verification_codes(lower(email));

COMMIT;
