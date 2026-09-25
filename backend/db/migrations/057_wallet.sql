ALTER TABLE users ADD COLUMN balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0);

CREATE TABLE wallet_topups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('momo', 'paypack')),
  reference     TEXT NOT NULL UNIQUE,
  phone_number  TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCESSFUL','FAILED')),
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_topups_user ON wallet_topups (user_id);
CREATE TRIGGER trg_wallet_topups_updated_at BEFORE UPDATE ON wallet_topups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('topup', 'purchase', 'refund')),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  balance_after NUMERIC(12,2) NOT NULL,
  reference     TEXT,
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions (user_id, created_at DESC);

ALTER TABLE orders ADD COLUMN wallet_refunded_at TIMESTAMPTZ;
