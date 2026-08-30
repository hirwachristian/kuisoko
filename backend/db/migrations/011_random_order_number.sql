-- Switches order_number from a sequential identity (100000, 100001, 100002, ...) to a
-- random unique 6-digit number, so order volume can't be inferred from the order number.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/011_random_order_number.sql

BEGIN;

CREATE FUNCTION generate_order_number() RETURNS BIGINT AS $$
DECLARE
  new_number BIGINT;
BEGIN
  LOOP
    new_number := floor(random() * 900000 + 100000)::BIGINT; -- 100000-999999
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_number);
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE orders ALTER COLUMN order_number DROP IDENTITY IF EXISTS;
ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT generate_order_number();

COMMIT;
