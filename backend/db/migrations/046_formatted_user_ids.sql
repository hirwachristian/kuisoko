BEGIN;

-- New users get an id like KU-A1B2C3 (generated in application code) instead of an
-- auto-incrementing number. Existing users keep their current numeric id - it just becomes a
-- TEXT value (e.g. 1 -> '1') rather than being rewritten, so every existing relationship
-- (orders, reviews, chat history, sessions) stays intact with no data migration needed.

-- 1. Drop every foreign key that points at users(id) - a column's type can't change while a FK
--    with a mismatched type still references it. Found dynamically so this doesn't depend on
--    guessing Postgres's auto-generated constraint names.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE confrelid = 'users'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2. Convert users.id itself: drop the identity/auto-increment property, widen to TEXT.
ALTER TABLE users ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;

-- 3. Widen every referencing column to match.
ALTER TABLE password_reset_tokens ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE email_change_tokens ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE two_factor_codes ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE reviews ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE wishlists ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE cart_items ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE orders ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE orders ALTER COLUMN rider_id TYPE TEXT USING rider_id::text;
ALTER TABLE orders ALTER COLUMN previous_rider_id TYPE TEXT USING previous_rider_id::text;
ALTER TABLE rider_locations ALTER COLUMN rider_id TYPE TEXT USING rider_id::text;
ALTER TABLE newsletter_subscribers ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE chat_messages ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE chat_messages ALTER COLUMN sender_id TYPE TEXT USING sender_id::text;
ALTER TABLE enquiries ALTER COLUMN replied_by TYPE TEXT USING replied_by::text;

-- 4. Re-add the foreign keys with their original delete behavior.
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE email_change_tokens ADD CONSTRAINT email_change_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE two_factor_codes ADD CONSTRAINT two_factor_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD CONSTRAINT orders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD CONSTRAINT orders_previous_rider_id_fkey FOREIGN KEY (previous_rider_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rider_locations ADD CONSTRAINT rider_locations_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
