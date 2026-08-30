-- Visual "search by photo" support: a lightweight perceptual hash (dHash) computed for each
-- product's primary image, compared via Hamming distance against an uploaded query photo's hash.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/025_product_image_hash.sql

BEGIN;

ALTER TABLE products ADD COLUMN image_hash TEXT;

COMMIT;
