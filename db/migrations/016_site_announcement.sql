-- Singleton row holding the current site-wide announcement banner (shown above the navbar).
-- Populated when an admin sends an announcement with "Also show as a site banner" checked.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/016_site_announcement.sql

BEGIN;

CREATE TABLE site_announcement (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  message     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO site_announcement (id, message, is_active) VALUES (1, NULL, false);

CREATE TRIGGER trg_site_announcement_updated_at BEFORE UPDATE ON site_announcement
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
