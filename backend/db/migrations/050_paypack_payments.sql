-- Adds a table for Paypack (https://paypack.rw) cashin transactions - a second mobile money
-- option alongside the existing direct MTN MoMo integration (012_momo_payments.sql).
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/050_paypack_payments.sql

BEGIN;

CREATE TABLE paypack_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref           TEXT NOT NULL UNIQUE, -- transaction ref returned by Paypack's cashin call
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,        -- local-format number (e.g. 0788123456) the cashin prompt was sent to
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency      TEXT NOT NULL DEFAULT 'RWF',
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESSFUL', 'FAILED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_paypack_transactions_order_id ON paypack_transactions(order_id);
CREATE TRIGGER trg_paypack_transactions_updated_at BEFORE UPDATE ON paypack_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
