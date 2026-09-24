-- A shared pool of admin-uploaded images, independently assignable to the homepage hero
-- ("hello section") and the About Us section - replaces the hardcoded HERO_SLIDES/ABOUT_IMAGES
-- arrays previously baked into frontend source. Order within each section is the array order on
-- app_settings, not a column on site_images itself (an image can be in both sections at different
-- positions in each, so a single shared order column couldn't represent that).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/055_site_images.sql

BEGIN;

CREATE TABLE site_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ADD COLUMN hero_image_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE app_settings ADD COLUMN about_image_ids UUID[] NOT NULL DEFAULT '{}';

COMMIT;
