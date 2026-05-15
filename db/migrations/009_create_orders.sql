-- =============================================================================
-- Migration 009: Create orders and order_items tables
-- =============================================================================

BEGIN;

-- ── ENUM types ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── orders ────────────────────────────────────────────────────────────────────
-- One order per customer queue join event.
-- Linked to a queue_entry; contains the list of selected products.

CREATE TABLE IF NOT EXISTS orders (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID           NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  queue_entry_id   UUID           REFERENCES queue_entries(id) ON DELETE SET NULL,
  order_number     TEXT           NOT NULL,       -- human-readable, e.g. "A001"
  customer_name    TEXT,
  status           order_status   NOT NULL DEFAULT 'pending',
  subtotal         NUMERIC(12,2)  NOT NULL DEFAULT 0,
  payment_status   payment_status NOT NULL DEFAULT 'unpaid',
  payment_code     TEXT,          -- bank transfer reference or QR string
  notes            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_order_number_org_unique UNIQUE (organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS orders_organization_id_idx ON orders (organization_id);
CREATE INDEX IF NOT EXISTS orders_queue_entry_id_idx  ON orders (queue_entry_id);
CREATE INDEX IF NOT EXISTS orders_status_idx          ON orders (status);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── order_items ───────────────────────────────────────────────────────────────
-- Snapshot of each product selected at the time of order creation.

CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name          TEXT           NOT NULL,    -- snapshot
  product_price         NUMERIC(12,2)  NOT NULL,    -- snapshot
  service_time_minutes  INT            NOT NULL DEFAULT 30,  -- snapshot
  quantity              INT            NOT NULL DEFAULT 1,
  subtotal              NUMERIC(12,2)  NOT NULL,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

COMMIT;
