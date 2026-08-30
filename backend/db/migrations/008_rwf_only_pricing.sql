-- Drops multi-currency support: the store now deals exclusively in RWF.
-- Converts existing USD-denominated prices/totals to RWF (at 1 USD = 1200 RWF,
-- the rate already seeded in the currencies table) so real prices stay sensible
-- instead of just being relabeled.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/008_rwf_only_pricing.sql

BEGIN;

UPDATE products SET price = ROUND(price * 1200);
UPDATE product_variants SET price = ROUND(price * 1200);
UPDATE orders SET total = ROUND(total * 1200);
UPDATE order_items SET unit_price = ROUND(unit_price * 1200);

UPDATE app_settings SET default_currency = 'RWF' WHERE id = 1;

COMMIT;
