-- Lets an admin give a product per-image stock instead of color/size variants, for a product
-- that has several photos but isn't meant to vary by color or size (e.g. several distinct styles
-- shown as plain photos). A variant row is either a color/size row (image_url NULL) or an
-- image-stock row (color and size NULL, image_url set to one of the product's own images) -
-- reusing product_variants' existing lock/decrement/restore machinery for both, matched by
-- product_id + image_url the same way color/size rows are matched by product_id + color + size.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/053_variant_image_stock.sql

BEGIN;

ALTER TABLE product_variants ADD COLUMN image_url TEXT;

COMMIT;
