-- Customer <-> admin support chat: one running conversation per customer (identified by
-- user_id), all admins share the same inbox. Read flags are tracked separately per side so
-- each party's unread badge only reflects messages the *other* side sent.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/021_chat_messages.sql

BEGIN;

CREATE TABLE chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role    TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  sender_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_by_user   BOOLEAN NOT NULL DEFAULT false,
  read_by_admin  BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id, created_at);

COMMIT;
