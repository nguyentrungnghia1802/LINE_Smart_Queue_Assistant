-- =============================================================================
-- Migration 008: Add org contact fields + create products table
-- =============================================================================

BEGIN;

-- ── Extend organizations with contact / branding fields ──────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS address     TEXT,
  ADD COLUMN IF NOT EXISTS payment_info TEXT;  -- bank transfer / QR payment details

-- ── products ──────────────────────────────────────────────────────────────────
-- A product or service offered by an organization.
-- Customers select one or more products when joining the queue.

CREATE TABLE IF NOT EXISTS products (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT           NOT NULL,
  description           TEXT,
  image_url             TEXT,
  price                 NUMERIC(12,2)  NOT NULL DEFAULT 0,
  service_time_minutes  INT            NOT NULL DEFAULT 30,
  max_wait_minutes      INT,                        -- NULL = no auto-cancel limit
  requires_prepayment   BOOLEAN        NOT NULL DEFAULT FALSE,
  stock_quantity        INT,                        -- NULL = unlimited
  is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_organization_id_idx ON products (organization_id);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
