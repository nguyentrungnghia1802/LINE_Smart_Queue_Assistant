module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE payment_transactions
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN last_provider_event_at TIMESTAMPTZ,
  ADD CONSTRAINT payment_transactions_refunded_amount_valid CHECK (
    refunded_amount >= 0 AND refunded_amount <= amount
  );

ALTER TABLE orders
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT orders_refunded_amount_valid CHECK (
    refunded_amount >= 0 AND refunded_amount <= subtotal
  );

ALTER TABLE order_items
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT order_items_refunded_amount_valid CHECK (
    refunded_amount >= 0 AND refunded_amount <= prepaid_amount
  );

CREATE TABLE payment_reconciliation_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_reconciliation_source_valid CHECK (
    source IN ('webhook','manual','reconciliation','demo')
  ),
  CONSTRAINT payment_reconciliation_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX idx_payment_reconciliation_order
  ON payment_reconciliation_operations(order_id, created_at DESC);
CREATE INDEX idx_payment_reconciliation_transaction
  ON payment_reconciliation_operations(payment_transaction_id, created_at DESC);
CREATE INDEX idx_payment_reconciliation_org
  ON payment_reconciliation_operations(organization_id, created_at DESC);
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS payment_reconciliation_operations;
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_refunded_amount_valid,
  DROP COLUMN IF EXISTS refunded_amount;
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_refunded_amount_valid,
  DROP COLUMN IF EXISTS refunded_amount;
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_refunded_amount_valid,
  DROP COLUMN IF EXISTS last_provider_event_at,
  DROP COLUMN IF EXISTS refunded_amount;
  `);
};
