-- =============================================================================
-- LINE Smart Queue Assistant — CLEAN DATABASE RESET SCRIPT v2
-- Source of truth for local/dev database reset
--
-- WARNING:
--   This script DROPS the whole public schema and recreates all tables/types.
--   Use only for local/dev reset. Backup before running on any important DB.
--
-- Run:
--   psql -U postgres -d line_queue -f reset_line_queue_schema_v2_clean.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Hard reset public schema
-- -----------------------------------------------------------------------------
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Utility trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. ENUM types
-- -----------------------------------------------------------------------------
-- Baseline user roles. Admin is a platform role and does not require org membership.
-- No other platform roles are part of this baseline.
CREATE TYPE user_role AS ENUM (
  'customer',
  'staff',
  'manager',
  'admin'
);

-- Role theo từng doanh nghiệp. Quyền thật của staff/manager phải check ở bảng này.
CREATE TYPE org_member_role AS ENUM (
  'manager',
  'staff'
);

CREATE TYPE product_type AS ENUM (
  'product',
  'service'
);

CREATE TYPE queue_status AS ENUM (
  'closed',
  'open',
  'paused',
  'archived'
);

CREATE TYPE queue_type AS ENUM (
  'walk_in',
  'appointment',
  'priority',
  'disaster'
);

CREATE TYPE queue_entry_status AS ENUM (
  'waiting',
  'called',
  'serving',
  'served',
  'skipped',
  'cancelled',
  'no_show'
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'pending',
  'authorized',
  'paid',
  'refunded',
  'failed',
  'cancelled'
);

CREATE TYPE notification_type AS ENUM (
  'queue_joined',
  'queue_near_turn',
  'queue_called',
  'queue_skipped',
  'queue_cancelled',
  'queue_serving',
  'queue_served',
  'queue_no_show',
  'payment_required',
  'payment_received',
  'location_warning'
);

CREATE TYPE notification_channel AS ENUM (
  'line_push',
  'email',
  'sms',
  'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed',
  'cancelled'
);

CREATE TYPE penalty_type AS ENUM (
  'no_show',
  'late_arrival',
  'excessive_cancel',
  'manual'
);

CREATE TYPE audit_actor_type AS ENUM (
  'user',
  'system',
  'line_webhook',
  'scheduler'
);

-- -----------------------------------------------------------------------------
-- 3. Identity / tenant tables
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  public_qr_token   TEXT NOT NULL UNIQUE,
  logo_url          TEXT,
  phone             TEXT,
  address           TEXT,
  latitude          NUMERIC(9,6),
  longitude         NUMERIC(9,6),
  payment_info      TEXT,
  line_channel_id   TEXT,
  line_oa_basic_id  TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  postal_code       TEXT,
  prefecture        TEXT,
  city              TEXT,
  address_line1     TEXT,
  address_line2     TEXT,
  settings          JSONB NOT NULL DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organizations_slug_format
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT organizations_public_qr_token_format
    CHECK (public_qr_token ~ '^[A-Za-z0-9_-]{8,128}$'),
  CONSTRAINT organizations_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT organizations_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT organizations_postal_code_format CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{3}-?[0-9]{4}$')
);

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organization_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  opens_at TIME,
  closes_at TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, weekday),
  CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL) OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);
CREATE TRIGGER trg_organization_business_hours_updated_at BEFORE UPDATE ON organization_business_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organization_exception_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  opens_at TIME,
  closes_at TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, exception_date),
  CHECK ((is_closed AND opens_at IS NULL AND closes_at IS NULL) OR (NOT is_closed AND opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at < closes_at))
);
CREATE TRIGGER trg_organization_exception_days_updated_at BEFORE UPDATE ON organization_exception_days FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name   TEXT NOT NULL,
  email          TEXT UNIQUE,
  phone          TEXT,
  role           user_role NOT NULL DEFAULT 'customer',
  password_hash  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organization_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             org_member_role NOT NULL DEFAULT 'staff',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT org_members_unique UNIQUE (organization_id, user_id)
);

CREATE TABLE line_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_user_id      TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  picture_url       TEXT,
  status_message    TEXT,
  is_linked         BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT line_accounts_user_id_unique UNIQUE (user_id)
);

-- -----------------------------------------------------------------------------
-- 4. Catalog / queue / order tables
-- -----------------------------------------------------------------------------
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  image_url             TEXT,
  product_type          product_type NOT NULL DEFAULT 'service',
  price                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_time_minutes  INT NOT NULL DEFAULT 30,
  max_wait_minutes      INT,
  requires_prepayment   BOOLEAN NOT NULL DEFAULT FALSE,
  stock_quantity        INT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT products_price_non_negative CHECK (price >= 0),
  CONSTRAINT products_service_time_positive CHECK (service_time_minutes > 0),
  CONSTRAINT products_max_wait_positive CHECK (max_wait_minutes IS NULL OR max_wait_minutes > 0),
  CONSTRAINT products_stock_non_negative CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  CONSTRAINT products_service_stock_rule CHECK (product_type = 'product' OR stock_quantity IS NULL)
);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE queues (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name                       TEXT NOT NULL,
  description                TEXT,
  status                     queue_status NOT NULL DEFAULT 'closed',
  queue_type                 queue_type NOT NULL DEFAULT 'walk_in',
  prefix                     TEXT NOT NULL DEFAULT '',
  max_capacity               INT,
  daily_ticket_counter       INT NOT NULL DEFAULT 0,
  last_counter_reset_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  avg_service_seconds        INT NOT NULL DEFAULT 300,
  notify_ahead_positions     INT NOT NULL DEFAULT 3,
  allow_skip                 BOOLEAN NOT NULL DEFAULT TRUE,
  max_skips_before_penalty   INT NOT NULL DEFAULT 2,
  auto_no_show_minutes       INT,
  opens_at                   TIME,
  closes_at                  TIME,
  settings                   JSONB NOT NULL DEFAULT '{}',
  is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT queues_prefix_format CHECK (prefix ~ '^[A-Za-z0-9]{0,5}$'),
  CONSTRAINT queues_max_capacity_positive CHECK (max_capacity IS NULL OR max_capacity > 0),
  CONSTRAINT queues_daily_counter_non_negative CHECK (daily_ticket_counter >= 0),
  CONSTRAINT queues_avg_service_seconds_pos CHECK (avg_service_seconds > 0),
  CONSTRAINT queues_notify_ahead_positive CHECK (notify_ahead_positions > 0),
  CONSTRAINT queues_max_skips_non_negative CHECK (max_skips_before_penalty >= 0),
  CONSTRAINT queues_auto_no_show_minutes_positive CHECK (auto_no_show_minutes IS NULL OR auto_no_show_minutes > 0),
  CONSTRAINT queues_hours_valid CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at)
);

COMMENT ON COLUMN queues.auto_no_show_minutes IS
  'Grace period in minutes before a called ticket is auto-marked no_show. NULL = use app/global default.';

CREATE TRIGGER trg_queues_updated_at
BEFORE UPDATE ON queues
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE booking_groups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_line_user_id TEXT,
  local_device_key   TEXT,
  status             TEXT NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_groups_status_valid CHECK (status IN ('active', 'completed', 'cancelled'))
);

CREATE TRIGGER trg_booking_groups_updated_at
BEFORE UPDATE ON booking_groups
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  booking_group_id       UUID REFERENCES booking_groups(id) ON DELETE SET NULL,
  customer_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_line_user_id  TEXT,
  order_number           TEXT NOT NULL,
  customer_name          TEXT,
  customer_phone         TEXT,
  status                 order_status NOT NULL DEFAULT 'pending',
  subtotal               NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status         payment_status NOT NULL DEFAULT 'unpaid',
  payment_code           TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_order_number_org_unique UNIQUE (organization_id, order_number),
  CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0)
);

COMMENT ON COLUMN orders.customer_user_id IS 'Links order to internal user when authenticated or LINE-linked.';
COMMENT ON COLUMN orders.customer_line_user_id IS 'LINE user id snapshot when the customer comes from LIFF/LINE but may not have an internal user yet.';
COMMENT ON COLUMN orders.customer_phone IS 'Customer contact phone for demo/business follow-up.';

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  order_id                 UUID REFERENCES orders(id) ON DELETE SET NULL,
  provider                 TEXT NOT NULL DEFAULT 'demo',
  method                   TEXT NOT NULL,
  payment_intent_id        TEXT,
  external_transaction_id  TEXT,
  status                   payment_status NOT NULL DEFAULT 'pending',
  amount                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'JPY',
  redirect_url             TEXT,
  checkout_url             TEXT,
  return_url               TEXT,
  webhook_status           TEXT,
  webhook_event_id         TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  raw_payload              JSONB NOT NULL DEFAULT '{}',
  authorized_at            TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  failed_at                TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,
  last_verified_at         TIMESTAMPTZ,
  last_error               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_transactions_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payment_transactions_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER trg_payment_transactions_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_webhook_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                 TEXT NOT NULL,
  event_id                 TEXT NOT NULL,
  event_type               TEXT NOT NULL,
  payment_transaction_id   UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  signature_valid          BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status        TEXT NOT NULL DEFAULT 'received',
  raw_payload              JSONB NOT NULL DEFAULT '{}',
  error_message            TEXT,
  processed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_webhook_events_status_valid CHECK (
    processing_status IN ('received', 'processed', 'failed')
  ),
  CONSTRAINT payment_webhook_events_unique_event UNIQUE (provider, event_id)
);

CREATE TABLE order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name          TEXT NOT NULL,
  product_price         NUMERIC(12,2) NOT NULL,
  service_time_minutes  INT NOT NULL DEFAULT 30,
  quantity              INT NOT NULL DEFAULT 1,
  subtotal              NUMERIC(12,2) NOT NULL,
  payment_status        payment_status NOT NULL DEFAULT 'unpaid',
  prepaid_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  requires_prepayment_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_product_price_non_negative CHECK (product_price >= 0),
  CONSTRAINT order_items_service_time_positive CHECK (service_time_minutes > 0),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT order_items_prepaid_amount_non_negative CHECK (prepaid_amount >= 0)
);

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

CREATE TABLE queue_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id                 UUID NOT NULL REFERENCES queues(id) ON DELETE RESTRICT,
  user_id                  UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id                 UUID REFERENCES orders(id) ON DELETE SET NULL,
  line_user_id             TEXT,
  ticket_number            INT NOT NULL,
  ticket_code              TEXT NOT NULL,
  status                   queue_entry_status NOT NULL DEFAULT 'waiting',
  priority                 INT NOT NULL DEFAULT 0,
  position_snapshot        INT,
  estimated_wait_seconds   INT,
  called_at                TIMESTAMPTZ,
  serving_started_at       TIMESTAMPTZ,
  served_at                TIMESTAMPTZ,
  skipped_at               TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  no_show_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT queue_entries_ticket_unique UNIQUE (queue_id, ticket_number),
  CONSTRAINT queue_entries_ticket_code_unique UNIQUE (queue_id, ticket_code),
  CONSTRAINT queue_entries_one_entry_per_order UNIQUE (order_id),
  CONSTRAINT queue_entries_ticket_number_positive CHECK (ticket_number > 0),
  CONSTRAINT queue_entries_priority_non_negative CHECK (priority >= 0),
  CONSTRAINT queue_entries_position_non_negative CHECK (position_snapshot IS NULL OR position_snapshot >= 0),
  CONSTRAINT queue_entries_eta_non_negative CHECK (estimated_wait_seconds IS NULL OR estimated_wait_seconds >= 0)
);

CREATE TRIGGER trg_queue_entries_updated_at
BEFORE UPDATE ON queue_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE customer_locations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_entry_id           UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
  customer_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_line_user_id    TEXT,
  local_device_key         TEXT,
  latitude                 NUMERIC(9,6) NOT NULL,
  longitude                NUMERIC(9,6) NOT NULL,
  accuracy_meters          INT,
  distance_to_org_meters   INT,
  captured_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_locations_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT customer_locations_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT customer_locations_accuracy_non_negative CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  CONSTRAINT customer_locations_distance_non_negative CHECK (distance_to_org_meters IS NULL OR distance_to_org_meters >= 0)
);

CREATE TABLE location_alerts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_entry_id           UUID REFERENCES queue_entries(id) ON DELETE CASCADE,
  customer_location_id     UUID REFERENCES customer_locations(id) ON DELETE SET NULL,
  alert_type               TEXT NOT NULL DEFAULT 'far_before_turn',
  status                   TEXT NOT NULL DEFAULT 'pending',
  distance_to_org_meters   INT,
  threshold_meters         INT NOT NULL DEFAULT 1000,
  due_at                   TIMESTAMPTZ,
  sent_at                  TIMESTAMPTZ,
  raw_payload              JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT location_alerts_status_valid CHECK (status IN ('pending', 'sent', 'skipped', 'failed'))
);

CREATE TRIGGER trg_location_alerts_updated_at
BEFORE UPDATE ON location_alerts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wait_time_forecasts (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  queue_id                   UUID REFERENCES queues(id) ON DELETE CASCADE,
  forecasted_wait_seconds    INT NOT NULL,
  queue_depth                INT NOT NULL DEFAULT 0,
  active_staff_count         INT,
  confidence                 NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  model_version              TEXT NOT NULL DEFAULT 'heuristic-v1',
  features                   JSONB NOT NULL DEFAULT '{}',
  generated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT wait_time_forecasts_wait_non_negative CHECK (forecasted_wait_seconds >= 0),
  CONSTRAINT wait_time_forecasts_queue_depth_non_negative CHECK (queue_depth >= 0),
  CONSTRAINT wait_time_forecasts_confidence_range CHECK (confidence BETWEEN 0 AND 1)
);

CREATE TABLE staffing_recommendations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day_of_week                INT NOT NULL,
  hour_of_day                INT NOT NULL,
  recommended_staff_count    INT NOT NULL,
  confidence                 NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  model_version              TEXT NOT NULL DEFAULT 'heuristic-v1',
  features                   JSONB NOT NULL DEFAULT '{}',
  generated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT staffing_recommendations_day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT staffing_recommendations_hour_range CHECK (hour_of_day BETWEEN 0 AND 23),
  CONSTRAINT staffing_recommendations_staff_positive CHECK (recommended_staff_count > 0),
  CONSTRAINT staffing_recommendations_confidence_range CHECK (confidence BETWEEN 0 AND 1)
);

-- -----------------------------------------------------------------------------
-- 5. Support / automation tables
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  queue_entry_id   UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  line_user_id      TEXT,
  type              notification_type NOT NULL,
  event_key         TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  channel           notification_channel NOT NULL DEFAULT 'line_push',
  status            notification_status NOT NULL DEFAULT 'pending',
  payload           JSONB NOT NULL DEFAULT '{}',
  retry_count       INT NOT NULL DEFAULT 0,
  attempt_count     INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 5,
  next_retry_at     TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  error_message     TEXT,
  last_error        TEXT,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_retry_count_non_negative CHECK (retry_count >= 0),
  CONSTRAINT notifications_attempt_count_non_negative CHECK (attempt_count >= 0),
  CONSTRAINT notifications_max_attempts_positive CHECK (max_attempts > 0),
  CONSTRAINT notifications_event_key_unique UNIQUE (event_key),
  CONSTRAINT notifications_has_recipient CHECK (user_id IS NOT NULL OR line_user_id IS NOT NULL)
);

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE penalty_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  queue_id          UUID REFERENCES queues(id) ON DELETE SET NULL,
  queue_entry_id    UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  line_user_id      TEXT,
  penalty_type      penalty_type NOT NULL DEFAULT 'no_show',
  points            INT NOT NULL DEFAULT 1,
  reason            TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT penalty_records_points_positive CHECK (points > 0),
  CONSTRAINT penalty_records_has_target CHECK (user_id IS NOT NULL OR line_user_id IS NOT NULL)
);

CREATE TABLE queue_histories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  queue_id          UUID NOT NULL REFERENCES queues(id) ON DELETE RESTRICT,
  queue_entry_id    UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
  actor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type        audit_actor_type NOT NULL DEFAULT 'user',
  line_user_id      TEXT,
  ticket_number     INT,
  ticket_code       TEXT,
  from_status       queue_entry_status,
  to_status         queue_entry_status NOT NULL,
  reason            TEXT,
  wait_seconds      INT,
  service_seconds   INT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT queue_histories_wait_non_negative CHECK (wait_seconds IS NULL OR wait_seconds >= 0),
  CONSTRAINT queue_histories_service_non_negative CHECK (service_seconds IS NULL OR service_seconds >= 0)
);

CREATE TABLE audit_logs (
  id                BIGSERIAL PRIMARY KEY,
  actor_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type        audit_actor_type NOT NULL DEFAULT 'user',
  action            TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  resource_id       UUID,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  changes           JSONB,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_users_role_active ON users(role) WHERE is_active = TRUE;
CREATE INDEX idx_users_email_active ON users(email) WHERE email IS NOT NULL AND is_active = TRUE;
CREATE INDEX idx_users_phone_active ON users(phone) WHERE phone IS NOT NULL AND is_active = TRUE;

CREATE INDEX idx_org_public_qr_active ON organizations(public_qr_token) WHERE is_active = TRUE;

CREATE INDEX idx_om_user_id ON organization_members(user_id);
CREATE INDEX idx_om_org_role_active ON organization_members(organization_id, role) WHERE is_active = TRUE;

CREATE INDEX idx_la_line_user_id ON line_accounts(line_user_id);
CREATE INDEX idx_la_user_id ON line_accounts(user_id);

CREATE INDEX idx_products_org_active ON products(organization_id, product_type, is_active);
CREATE INDEX idx_products_org_name ON products(organization_id, name);

CREATE INDEX idx_queues_org_active ON queues(organization_id, status) WHERE is_active = TRUE;

CREATE INDEX idx_orders_org_created ON orders(organization_id, created_at DESC);
CREATE INDEX idx_orders_org_status_created ON orders(organization_id, status, created_at DESC);
CREATE INDEX idx_orders_booking_group ON orders(booking_group_id) WHERE booking_group_id IS NOT NULL;
CREATE INDEX idx_orders_customer_user_id ON orders(customer_user_id) WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_orders_customer_line_user_id ON orders(customer_line_user_id) WHERE customer_line_user_id IS NOT NULL;
CREATE INDEX idx_orders_completed_revenue ON orders(organization_id, created_at DESC)
  WHERE status = 'completed' AND payment_status = 'paid';

CREATE INDEX idx_payment_transactions_org_created ON payment_transactions(organization_id, created_at DESC);
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_external ON payment_transactions(provider, external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_intent ON payment_transactions(provider, payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_state ON payment_transactions(organization_id, status, created_at DESC);
CREATE INDEX idx_payment_webhook_events_transaction ON payment_webhook_events(payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_order_covering ON order_items(order_id)
  INCLUDE (product_name, quantity, subtotal, service_time_minutes);
CREATE INDEX idx_order_items_payment_status ON order_items(order_id, payment_status);

CREATE INDEX idx_inventory_reservations_product_active ON inventory_reservations(product_id, status)
  WHERE status = 'reserved';
CREATE INDEX idx_inventory_reservations_order ON inventory_reservations(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX idx_qe_queue_status_ticket ON queue_entries(queue_id, status, priority DESC, ticket_number ASC);
CREATE INDEX idx_qe_queue_waiting ON queue_entries(queue_id, priority DESC, ticket_number ASC)
  WHERE status = 'waiting';
CREATE INDEX idx_qe_queue_active ON queue_entries(queue_id, status, created_at)
  WHERE status IN ('waiting', 'called', 'serving');
CREATE INDEX idx_qe_user_active ON queue_entries(user_id, created_at DESC)
  WHERE user_id IS NOT NULL AND status IN ('waiting', 'called', 'serving');
CREATE INDEX idx_qe_line_user_active ON queue_entries(line_user_id, created_at DESC)
  WHERE line_user_id IS NOT NULL AND status IN ('waiting', 'called', 'serving');
CREATE INDEX idx_qe_order_id ON queue_entries(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_qe_called_timeout ON queue_entries(queue_id, called_at)
  WHERE status = 'called';

CREATE INDEX idx_booking_groups_org_updated ON booking_groups(organization_id, updated_at DESC);
CREATE INDEX idx_booking_groups_customer_updated ON booking_groups(customer_user_id, updated_at DESC) WHERE customer_user_id IS NOT NULL;
CREATE INDEX idx_booking_groups_line_updated ON booking_groups(customer_line_user_id, updated_at DESC) WHERE customer_line_user_id IS NOT NULL;
CREATE INDEX idx_organization_exception_days_lookup ON organization_exception_days(organization_id, exception_date);
CREATE INDEX idx_customer_locations_entry ON customer_locations(queue_entry_id) WHERE queue_entry_id IS NOT NULL;
CREATE INDEX idx_customer_locations_org_captured ON customer_locations(organization_id, captured_at DESC);
CREATE INDEX idx_location_alerts_pending ON location_alerts(organization_id, due_at)
  WHERE status = 'pending';
CREATE INDEX idx_wait_time_forecasts_org_generated ON wait_time_forecasts(organization_id, generated_at DESC);
CREATE INDEX idx_staffing_recommendations_org_slot ON staffing_recommendations(organization_id, day_of_week, hour_of_day);

CREATE INDEX idx_notif_pending ON notifications(created_at)
  WHERE status = 'pending';
CREATE INDEX idx_notif_processing ON notifications(created_at)
  WHERE status = 'processing';
CREATE INDEX idx_notif_org_recent ON notifications(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX idx_notif_due_line_outbox ON notifications(next_retry_at, created_at)
  WHERE channel = 'line_push' AND status = 'pending';
CREATE INDEX idx_notif_entry_event ON notifications(queue_entry_id, event_type)
  WHERE queue_entry_id IS NOT NULL;
CREATE INDEX idx_notif_retry_due ON notifications(next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;
CREATE INDEX idx_notif_entry_type ON notifications(queue_entry_id, type, created_at DESC)
  WHERE queue_entry_id IS NOT NULL;
CREATE INDEX idx_notif_user_recent ON notifications(user_id, created_at DESC)
  WHERE user_id IS NOT NULL AND status IN ('sent', 'delivered');
CREATE INDEX idx_notif_line_user_recent ON notifications(line_user_id, created_at DESC)
  WHERE line_user_id IS NOT NULL AND status IN ('sent', 'delivered');

CREATE INDEX idx_penalty_user_recent ON penalty_records(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_penalty_line_user_recent ON penalty_records(line_user_id, created_at DESC)
  WHERE line_user_id IS NOT NULL;
CREATE INDEX idx_penalty_org_user_recent ON penalty_records(organization_id, user_id, created_at DESC)
  WHERE organization_id IS NOT NULL AND user_id IS NOT NULL;

CREATE INDEX idx_qh_org_recent ON queue_histories(organization_id, created_at DESC);
CREATE INDEX idx_qh_queue_recent ON queue_histories(queue_id, created_at DESC);
CREATE INDEX idx_qh_entry ON queue_histories(queue_entry_id) WHERE queue_entry_id IS NOT NULL;
CREATE INDEX idx_qh_actor_recent ON queue_histories(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);

-- Operational correctness additions (migration 000007)
ALTER TABLE organizations ALTER COLUMN timezone SET DEFAULT 'Asia/Tokyo';

CREATE TABLE organization_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_order_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_counters_order_positive CHECK (next_order_number > 0)
);

ALTER TABLE queues ADD COLUMN counter_business_date DATE;
ALTER TABLE queue_entries ADD COLUMN business_date DATE NOT NULL DEFAULT (CURRENT_DATE);
ALTER TABLE queue_entries
  DROP CONSTRAINT queue_entries_ticket_unique,
  DROP CONSTRAINT queue_entries_ticket_code_unique,
  ADD CONSTRAINT queue_entries_daily_ticket_unique UNIQUE (queue_id, business_date, ticket_number),
  ADD CONSTRAINT queue_entries_daily_code_unique UNIQUE (queue_id, business_date, ticket_code);
ALTER TABLE queue_entries ALTER COLUMN business_date DROP DEFAULT;

ALTER TABLE orders ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE inventory_reservations
  ADD COLUMN consumed_at TIMESTAMPTZ,
  ADD COLUMN released_at TIMESTAMPTZ,
  ADD COLUMN expired_at TIMESTAMPTZ,
  ADD COLUMN release_reason TEXT;

CREATE UNIQUE INDEX idx_inventory_reservations_order_product
  ON inventory_reservations(order_id, product_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_inventory_reservations_expiry
  ON inventory_reservations(expires_at) WHERE status = 'reserved' AND expires_at IS NOT NULL;

CREATE TABLE inventory_reservation_events (
  id BIGSERIAL PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reservation_events_status CHECK (to_status IN ('reserved', 'consumed', 'released', 'expired')),
  CONSTRAINT inventory_reservation_events_quantity_positive CHECK (quantity > 0)
);
CREATE INDEX idx_inventory_events_order ON inventory_reservation_events(order_id, created_at DESC);
CREATE INDEX idx_inventory_events_reservation ON inventory_reservation_events(reservation_id, created_at DESC);

CREATE TABLE scheduler_job_runs (
  job_name TEXT PRIMARY KEY,
  owner_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduler_job_runs_status CHECK (status IN ('idle', 'running', 'succeeded', 'failed'))
);

-- Payment reconciliation additions (migration 000008)
ALTER TABLE payment_transactions
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN last_provider_event_at TIMESTAMPTZ,
  ADD CONSTRAINT payment_transactions_refunded_amount_valid CHECK (refunded_amount >= 0 AND refunded_amount <= amount);
ALTER TABLE orders
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT orders_refunded_amount_valid CHECK (refunded_amount >= 0 AND refunded_amount <= subtotal);
ALTER TABLE order_items
  ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT order_items_refunded_amount_valid CHECK (refunded_amount >= 0 AND refunded_amount <= prepaid_amount);

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
  CONSTRAINT payment_reconciliation_source_valid CHECK (source IN ('webhook','manual','reconciliation','demo')),
  CONSTRAINT payment_reconciliation_amount_non_negative CHECK (amount >= 0)
);
CREATE INDEX idx_payment_reconciliation_order ON payment_reconciliation_operations(order_id, created_at DESC);
CREATE INDEX idx_payment_reconciliation_transaction ON payment_reconciliation_operations(payment_transaction_id, created_at DESC);
CREATE INDEX idx_payment_reconciliation_org ON payment_reconciliation_operations(organization_id, created_at DESC);

-- Notification consent and location privacy additions (migration 000009)
CREATE TABLE line_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL UNIQUE,
  follow_state TEXT NOT NULL DEFAULT 'unknown',
  notification_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  approaching_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  called_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lifecycle_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  consented_at TIMESTAMPTZ,
  consent_source TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT line_preferences_follow_state CHECK (follow_state IN ('unknown','followed','unfollowed')),
  CONSTRAINT line_preferences_consent_source CHECK (consent_source IS NULL OR consent_source IN ('line_follow','liff_settings','legacy_link'))
);
CREATE TRIGGER trg_line_notification_preferences_updated_at BEFORE UPDATE ON line_notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE notifications
  ADD COLUMN manual_retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN operator_note TEXT,
  ADD CONSTRAINT notifications_manual_retry_non_negative CHECK (manual_retry_count >= 0);
CREATE TABLE customer_location_consents (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  consented_at TIMESTAMPTZ,
  consent_source TEXT,
  revoked_at TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT location_consent_source CHECK (consent_source IS NULL OR consent_source IN ('liff_booking','liff_settings'))
);
CREATE TRIGGER trg_customer_location_consents_updated_at BEFORE UPDATE ON customer_location_consents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE customer_locations
  ADD COLUMN consent_user_id UUID REFERENCES customer_location_consents(user_id) ON DELETE SET NULL,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN anonymized_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE location_alerts
  ADD COLUMN event_key TEXT NOT NULL UNIQUE,
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN next_retry_at TIMESTAMPTZ,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT,
  ADD CONSTRAINT location_alerts_attempt_non_negative CHECK (attempt_count >= 0);
CREATE INDEX idx_line_preferences_delivery ON line_notification_preferences(line_user_id) WHERE notification_enabled = TRUE AND follow_state = 'followed';
CREATE INDEX idx_customer_locations_expiry ON customer_locations(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_location_alerts_delivery_due ON location_alerts(next_retry_at, due_at) WHERE status = 'pending';

COMMIT;
