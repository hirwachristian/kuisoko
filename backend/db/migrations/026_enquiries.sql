-- Contact Us submissions, surfaced to admins as an "Enquiries" inbox. Replies are sent by email
-- only, to whichever address the visitor provided - there's no guarantee they have an account or
-- would ever see an in-app reply, so email is the only reliable channel back to them.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/026_enquiries.sql

BEGIN;

CREATE TABLE enquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied')),
  reply_body  TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_unread   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiries_created_at ON enquiries(created_at DESC);

COMMIT;
