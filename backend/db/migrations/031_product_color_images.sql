-- Maps a variant color (e.g. "Red") to one of the product's own uploaded image URLs, so
-- selecting a color on the product page can jump the gallery straight to that color's photo,
-- and the same photo carries through to the cart/order line for that purchase.
ALTER TABLE products ADD COLUMN color_images JSONB NOT NULL DEFAULT '{}'::jsonb;
