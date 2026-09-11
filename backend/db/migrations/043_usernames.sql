-- Unique, public-facing username per account - shown on reviews instead of the reviewer's real
-- name, and usable alongside email as an identity going forward. Doesn't touch login, password
-- reset, or 2FA - those all stay keyed on email exactly as before; this is purely additive.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/043_usernames.sql

BEGIN;

ALTER TABLE users ADD COLUMN username TEXT;

-- Backfill existing accounts with a generated, guaranteed-unique handle derived from their name
-- (id suffix rules out any collision, including with each other and with the empty string for a
-- name with no alphanumeric characters at all) - real users pick their own going forward.
UPDATE users
SET username = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g')) || '_' || id::text
WHERE username IS NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Reviews snapshot the author's name at submission time already (survives account deletion) -
-- same treatment for username. Nullable: existing reviews, and any review from an account that's
-- since been deleted, simply have none - the UI falls back to the existing user_name in that case.
ALTER TABLE reviews ADD COLUMN user_username TEXT;
UPDATE reviews r SET user_username = u.username FROM users u WHERE r.user_id = u.id AND r.user_username IS NULL;

COMMIT;
