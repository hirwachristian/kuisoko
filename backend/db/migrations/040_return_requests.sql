-- Formal return/refund workflow: a customer can request a return on a Delivered order with a
-- reason; an admin Approves (order -> Returned, stock restored) or Rejects (with a reason shown
-- back to the customer). There's no live payment gateway in this app to push real money through,
-- so "refund" here is a status/workflow resolution, not an actual transaction - consistent with
-- how the rest of the order lifecycle (Cancelled, stock restore) already works.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/040_return_requests.sql

-- ALTER TYPE ... ADD VALUE cannot run inside the same transaction block as the table/index that
-- uses it (the new enum value isn't visible until the adding transaction commits), so this is two
-- separate statements/transactions rather than one wrapped BEGIN/COMMIT.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Returned';

BEGIN;

CREATE TABLE return_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note   TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  is_unread    BOOLEAN NOT NULL DEFAULT true,
  customer_unread BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE UNIQUE INDEX idx_return_requests_active ON return_requests(order_id) WHERE status IN ('pending', 'approved');

COMMIT;
