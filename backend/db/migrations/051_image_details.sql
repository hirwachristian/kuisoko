-- Lets an admin optionally set a name/description for individual product images, defaulting to
-- the product's own name/description when unset. Mirrors the existing color_images column.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/051_image_details.sql

BEGIN;

ALTER TABLE products ADD COLUMN image_details JSONB NOT NULL DEFAULT '{}'::jsonb;
-- maps an image URL (one of `images`) to { name?, description? } - only images an admin
-- deliberately annotated have an entry; everything else falls back to the product's own
-- name/description on read.

COMMIT;
