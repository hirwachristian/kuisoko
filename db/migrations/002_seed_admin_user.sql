-- Creates the initial admin account.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/002_seed_admin_user.sql

BEGIN;

INSERT INTO users (name, email, phone_number, password_hash, role)
VALUES (
  'Hirwa Admin',
  'hirwatech568@gmail.com',
  '0783655163',
  crypt('Admin@195', gen_salt('bf')), -- bcrypt hash, via pgcrypto (already enabled in schema.sql)
  'admin'
)
ON CONFLICT (email) DO NOTHING;

COMMIT;
