-- Lets a product carry one optional showcase/demo video, uploaded and stored the same way as
-- product images (see server/src/routes/uploads.ts).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/022_product_video.sql

BEGIN;

ALTER TABLE products ADD COLUMN video_url TEXT;

COMMIT;
