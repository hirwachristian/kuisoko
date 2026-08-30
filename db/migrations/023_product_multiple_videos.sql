-- Upgrades products from a single optional video (video_url) to multiple videos (video_urls),
-- mirroring the existing images array. Any product that already has a video keeps it, now as a
-- one-element array.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/023_product_multiple_videos.sql

BEGIN;

ALTER TABLE products ADD COLUMN video_urls TEXT[] NOT NULL DEFAULT '{}';

UPDATE products SET video_urls = ARRAY[video_url] WHERE video_url IS NOT NULL;

ALTER TABLE products DROP COLUMN video_url;

COMMIT;
