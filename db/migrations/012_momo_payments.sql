-- Adds payment tracking to orders and a table for MTN MoMo "Request to Pay" transactions.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/012_momo_payments.sql

BEGIN;

ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed'));
ALTER TABLE orders ADD COLUMN payment_method TEXT;

CREATE TABLE momo_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id  UUID NOT NULL UNIQUE, -- X-Reference-Id sent to the MTN MoMo API
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,        -- MSISDN the payment prompt was sent to
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency      TEXT NOT NULL DEFAULT 'EUR',
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESSFUL', 'FAILED')),
  reason        TEXT,                 -- failure reason, if any, from MTN
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_momo_transactions_order_id ON momo_transactions(order_id);
CREATE TRIGGER trg_momo_transactions_updated_at BEFORE UPDATE ON momo_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
