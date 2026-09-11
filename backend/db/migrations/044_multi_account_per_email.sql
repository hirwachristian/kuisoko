BEGIN;

-- One email may now back up to 3 accounts (each still with its own globally-unique username),
-- so it can no longer be a unique key. Login/password-reset are keyed by username where
-- disambiguation matters; email uniqueness is now enforced at the application level (capped at 3)
-- instead of by this constraint.
ALTER TABLE users DROP CONSTRAINT users_email_key;
CREATE INDEX idx_users_email ON users (email);

COMMIT;
