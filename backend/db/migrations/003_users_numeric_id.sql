-- Switches users.id from UUID to an auto-incrementing number (1, 2, 3, ...)
-- and retypes the columns in reviews, wishlists, orders, and
-- newsletter_subscribers that reference it.
--
-- Assumes these tables are still empty (true if you've only added and
-- deleted the one test admin row) -- run the SELECT checks below first if
-- you're not sure.
--
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/003_users_numeric_id.sql

BEGIN;

DROP TABLE users CASCADE;

CREATE TABLE users (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  phone_number      TEXT,
  address           TEXT,
  role              user_role NOT NULL DEFAULT 'user',
  profile_image     TEXT,
  is_unread         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reviews ALTER COLUMN user_id TYPE BIGINT USING NULL;
ALTER TABLE reviews ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE wishlists ALTER COLUMN user_id TYPE BIGINT USING NULL;
ALTER TABLE wishlists ADD CONSTRAINT wishlists_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE orders ALTER COLUMN user_id TYPE BIGINT USING NULL;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE newsletter_subscribers ALTER COLUMN user_id TYPE BIGINT USING NULL;
ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
