-- Adds the "Join our inner circle" newsletter signup table.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/001_newsletter_subscribers.sql

BEGIN;

CREATE TABLE newsletter_subscribers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL, -- set if the subscriber is also a registered user
  is_active        BOOLEAN NOT NULL DEFAULT true,
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at  TIMESTAMPTZ
);
CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers(email);

COMMIT;
