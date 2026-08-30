-- Replaces the single site_announcement row with a proper list, so multiple announcements
-- (at least 3) can be live in the banner at once, each independently turned off/expired.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/018_multiple_site_announcements.sql

BEGIN;

CREATE TABLE site_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ, -- NULL = no auto-expiry; only the admin can turn it off, no visitor dismiss
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_announcements_active ON site_announcements(is_active);
CREATE TRIGGER trg_site_announcements_updated_at BEFORE UPDATE ON site_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Carry over whatever was live in the old singleton row, if anything
INSERT INTO site_announcements (message, is_active, expires_at)
SELECT message, is_active, expires_at FROM site_announcement
WHERE id = 1 AND message IS NOT NULL AND is_active = true;

DROP TABLE site_announcement;

COMMIT;
