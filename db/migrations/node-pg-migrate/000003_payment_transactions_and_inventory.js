module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
CREATE TABLE payment_transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  order_id                 UUID REFERENCES orders(id) ON DELETE SET NULL,
  provider                 TEXT NOT NULL DEFAULT 'demo',
  method                   TEXT NOT NULL,
  external_transaction_id  TEXT,
  status                   payment_status NOT NULL DEFAULT 'unpaid',
  amount                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'JPY',
  redirect_url             TEXT,
  raw_payload              JSONB NOT NULL DEFAULT '{}',
  paid_at                  TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_transactions_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payment_transactions_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER trg_payment_transactions_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE order_items
  ADD COLUMN payment_status payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN prepaid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  ADD COLUMN requires_prepayment_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT order_items_prepaid_amount_non_negative CHECK (prepaid_amount >= 0);

CREATE TABLE inventory_reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id         UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity         INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'reserved',
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT inventory_reservations_quantity_positive CHECK (quantity > 0),
  CONSTRAINT inventory_reservations_status_valid CHECK (status IN ('reserved', 'consumed', 'released', 'expired'))
);

CREATE TRIGGER trg_inventory_reservations_updated_at
BEFORE UPDATE ON inventory_reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payment_transactions_org_created ON payment_transactions(organization_id, created_at DESC);
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_external ON payment_transactions(provider, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
CREATE INDEX idx_order_items_payment_status ON order_items(order_id, payment_status);
CREATE INDEX idx_inventory_reservations_product_active ON inventory_reservations(product_id, status)
  WHERE status = 'reserved';
CREATE INDEX idx_inventory_reservations_order ON inventory_reservations(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE payment_transactions IS
  'Payment provider transaction log. Supports demo checkout now and real PSP/webhook integration later.';
COMMENT ON COLUMN order_items.payment_status IS
  'Per-item payment state, needed when only prepayment-required items are paid before booking.';
COMMENT ON TABLE inventory_reservations IS
  'Tracks stock reservation/consumption for product orders to prevent overselling.';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS inventory_reservations CASCADE;
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_prepaid_amount_non_negative,
  DROP COLUMN IF EXISTS requires_prepayment_snapshot,
  DROP COLUMN IF EXISTS payment_transaction_id,
  DROP COLUMN IF EXISTS prepaid_amount,
  DROP COLUMN IF EXISTS payment_status;
DROP TABLE IF EXISTS payment_transactions CASCADE;
  `);
};
