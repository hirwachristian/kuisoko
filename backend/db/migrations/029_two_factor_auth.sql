-- Real two-factor authentication (email-based one-time codes), replacing the admin settings page's
-- previous "Enable 2FA" toggle, which was a pure UI mock - it flipped a local React boolean and
-- never touched the backend, login, or the database at all.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/029_two_factor_auth.sql

BEGIN;

ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- Single-use, expiring 6-digit codes - covers three flows that all need "prove you got an email
-- code": logging in with 2FA enabled, confirming 2FA setup, and (implicitly, via disable requiring
-- the password instead) turning it off. Same shape as password_reset_tokens/email_change_tokens.
CREATE TABLE two_factor_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_two_factor_codes_user_id ON two_factor_codes(user_id);

COMMIT;
