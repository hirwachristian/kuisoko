-- Categories/sections/items only ever had one name, in English, stored as the literal string used
-- everywhere as the identifier (product.category, URL query params, etc). Kinyarwanda translations
-- for the *original* seeded categories lived in a hardcoded frontend dictionary keyed by that
-- English string - so any category an admin added afterward had no way to be translated at all,
-- it would just always show in English regardless of the selected language.
--
-- Adds an admin-editable Kinyarwanda name alongside the English one, at every level.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/030_category_translations.sql

BEGIN;

ALTER TABLE categories ADD COLUMN name_kin TEXT;
ALTER TABLE category_sections ADD COLUMN title_kin TEXT;
ALTER TABLE category_sections ADD COLUMN items_kin TEXT[] NOT NULL DEFAULT '{}';

COMMIT;
