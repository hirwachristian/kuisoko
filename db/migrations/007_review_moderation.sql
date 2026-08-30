-- Adds admin moderation (hide/unhide) and unread-notification tracking to reviews,
-- and updates the rating trigger so hidden reviews no longer count toward the
-- product's public average rating / review count.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/007_review_moderation.sql

BEGIN;

ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN is_unread BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION refresh_product_rating() RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products p
  SET reviews_count = agg.cnt,
      rating = COALESCE(agg.avg_rating, 0)
  FROM (
    SELECT COUNT(*) AS cnt, ROUND(AVG(rating)::numeric, 1) AS avg_rating
    FROM reviews WHERE product_id = target_product_id AND is_hidden = false
  ) agg
  WHERE p.id = target_product_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
