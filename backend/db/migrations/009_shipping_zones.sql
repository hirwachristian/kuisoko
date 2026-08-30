-- Adds district-based shipping zones (admin-configurable flat fees) and records
-- the fee breakdown on each order. Run with:
-- psql -U postgres -h localhost -d kuisoko -f db/migrations/009_shipping_zones.sql

BEGIN;

CREATE TABLE shipping_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  districts   TEXT[] NOT NULL DEFAULT '{}',
  fee         NUMERIC(12,2) NOT NULL CHECK (fee >= 0),
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_shipping_zones_single_default ON shipping_zones (is_default) WHERE is_default;
CREATE TRIGGER trg_shipping_zones_updated_at BEFORE UPDATE ON shipping_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE shipping_settings (
  id                       SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  free_shipping_threshold  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_shipping_settings_updated_at BEFORE UPDATE ON shipping_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE orders ADD COLUMN subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0);
ALTER TABLE orders ADD COLUMN shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);
ALTER TABLE orders ADD COLUMN shipping_zone TEXT;
ALTER TABLE orders ADD COLUMN tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0);

-- Seed sensible defaults: Kigali's 3 real districts as a cheaper zone, everything else
-- falls back to the default zone. Adjust fees/districts freely from the admin UI.
INSERT INTO shipping_zones (name, districts, fee, is_default) VALUES
  ('Kigali City', ARRAY['Nyarugenge', 'Gasabo', 'Kicukiro'], 2000, false),
  ('Other Districts', ARRAY[]::TEXT[], 5000, true);

INSERT INTO shipping_settings (id, free_shipping_threshold) VALUES (1, 100000)
ON CONFLICT (id) DO NOTHING;

COMMIT;
