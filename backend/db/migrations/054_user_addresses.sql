-- A real, multi-entry address book per customer - replaces the single free-text users.address
-- column (left in place, unused by this feature) that the dashboard's old "Address Book" tab
-- actually bound to. Field names mirror deliveryAddressSchema in routes/orders.ts exactly, plus
-- label and is_default, so a saved address is already shaped like a checkout delivery address.
-- Only one is_default flag (not separate shipping/billing) - this app has no billing/invoicing
-- concept anywhere checkout only ever collects one delivery address.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/054_user_addresses.sql

BEGIN;

CREATE TABLE user_addresses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  phone_number        TEXT NOT NULL,
  country             TEXT NOT NULL,
  city_town           TEXT NOT NULL,
  district            TEXT NOT NULL,
  street_address      TEXT NOT NULL,
  house_building_no   TEXT,
  additional_info     TEXT,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  geocoded_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);

CREATE TRIGGER trg_user_addresses_updated_at BEFORE UPDATE ON user_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
