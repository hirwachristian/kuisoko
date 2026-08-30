-- "Forgot password" flow: single-use, expiring reset tokens emailed to the account holder.
-- Only the SHA-256 hash of the token is stored, never the raw value (same principle as
-- password hashing - a DB leak alone can't be used to reset anyone's password).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/020_password_reset_tokens.sql

BEGIN;

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

COMMIT;
