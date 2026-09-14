-- Expo push tokens, one row per device a user has signed in on the mobile app (not one column on
-- users - a customer can have the app installed on more than one phone, and each needs its own
-- token). A token is unique across the whole table (not per-user) since Expo can reassign a token
-- to a different install; upserting on that uniqueness re-points it at whichever account most
-- recently registered it instead of leaving a stale duplicate under the old owner.
CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
