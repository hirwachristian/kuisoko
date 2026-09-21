-- Prevents an order's stock from being restored more than once. Without this, an order that
-- transitions between the two stock-releasing states in either order (Cancelled -> Returned,
-- Returned -> Cancelled) - or is cancelled via the admin status dropdown after already having its
-- return approved via the separate /returns/:id/approve path - gets double-credited: both the
-- product's aggregate stock and the matching variant's stock get bumped twice for the same items.
-- Run with: psql -U postgres -h localhost -d kuisoko -f db/migrations/052_stock_restored_at.sql

BEGIN;

ALTER TABLE orders ADD COLUMN stock_restored_at TIMESTAMPTZ;

COMMIT;
