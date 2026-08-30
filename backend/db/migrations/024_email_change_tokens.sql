-- Email change verification: changing your account email requires proving you control the new
-- address first. Single-use, expiring tokens emailed to the *new* address, same principle as
-- password_reset_tokens - only the SHA-256 hash is stored, never the raw token.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/024_email_change_tokens.sql

BEGIN;

CREATE TABLE email_change_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_change_tokens_user_id ON email_change_tokens(user_id);

COMMIT;
