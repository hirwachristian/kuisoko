-- Remembers exactly which of a product's photos the customer was looking at when they added it
-- to the cart (e.g. the second of several cap photos on a product with no color variants to hang
-- the choice on) - without this, a cart line only knows selected_color/selected_size, so a
-- variant-less multi-image product always fell back to the product's first image in the order.
ALTER TABLE cart_items ADD COLUMN selected_image TEXT;
