-- Migration 010: Add required fields for target business model
-- Date: 2026-06-17
-- Purpose: Add product_type, customer linkage, and org QR token

-- ============================================================================
-- 1. Products: Add product_type to distinguish products vs services
-- ============================================================================

-- Create enum for product type
CREATE TYPE product_type AS ENUM ('product', 'service');

-- Add column with default 'product' for existing data
ALTER TABLE products 
  ADD COLUMN product_type product_type NOT NULL DEFAULT 'product';

COMMENT ON COLUMN products.product_type IS 'Distinguishes tangible products (goods) from services';

-- ============================================================================
-- 2. Orders: Add customer linkage fields
-- ============================================================================

-- Add customer_user_id to link orders to internal users
ALTER TABLE orders 
  ADD COLUMN customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add customer_phone for contact traceability
ALTER TABLE orders 
  ADD COLUMN customer_phone TEXT;

-- Create index for customer_user_id lookups
CREATE INDEX idx_orders_customer_user_id ON orders(customer_user_id) 
  WHERE customer_user_id IS NOT NULL;

COMMENT ON COLUMN orders.customer_user_id IS 'Links order to internal user (when authenticated)';
COMMENT ON COLUMN orders.customer_phone IS 'Customer contact phone for traceability';

-- ============================================================================
-- 3. Organizations: Add public QR token for stable routing
-- ============================================================================

-- Add public_qr_token with unique constraint
ALTER TABLE organizations 
  ADD COLUMN public_qr_token TEXT;

-- Create unique index
CREATE UNIQUE INDEX idx_organizations_public_qr_token 
  ON organizations(public_qr_token) 
  WHERE public_qr_token IS NOT NULL;

COMMENT ON COLUMN organizations.public_qr_token IS 'Stable token for public QR code routing';

-- ============================================================================
-- 4. Backfill public_qr_token for existing organizations
-- ============================================================================

-- Generate random tokens for existing organizations
UPDATE organizations 
SET public_qr_token = 'org_' || encode(gen_random_bytes(16), 'hex')
WHERE public_qr_token IS NULL;

-- Now make it NOT NULL
ALTER TABLE organizations 
  ALTER COLUMN public_qr_token SET NOT NULL;

-- ============================================================================
-- 5. Backfill customer_user_id from queue_entries where possible
-- ============================================================================

-- Link orders to users via queue_entry_id mapping
UPDATE orders o
SET customer_user_id = qe.user_id
FROM queue_entries qe
WHERE o.queue_entry_id = qe.id
  AND o.customer_user_id IS NULL
  AND qe.user_id IS NOT NULL;
