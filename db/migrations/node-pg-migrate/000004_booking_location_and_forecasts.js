module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TABLE organizations
  ADD COLUMN latitude NUMERIC(9,6),
  ADD COLUMN longitude NUMERIC(9,6),
  ADD CONSTRAINT organizations_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT organizations_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

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

ALTER TABLE orders
  ADD COLUMN booking_group_id UUID REFERENCES booking_groups(id) ON DELETE SET NULL;

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

CREATE INDEX idx_booking_groups_org_updated ON booking_groups(organization_id, updated_at DESC);
CREATE INDEX idx_orders_booking_group ON orders(booking_group_id) WHERE booking_group_id IS NOT NULL;
CREATE INDEX idx_customer_locations_entry ON customer_locations(queue_entry_id) WHERE queue_entry_id IS NOT NULL;
CREATE INDEX idx_customer_locations_org_captured ON customer_locations(organization_id, captured_at DESC);
CREATE INDEX idx_location_alerts_pending ON location_alerts(organization_id, due_at)
  WHERE status = 'pending';
CREATE INDEX idx_wait_time_forecasts_org_generated ON wait_time_forecasts(organization_id, generated_at DESC);
CREATE INDEX idx_staffing_recommendations_org_slot ON staffing_recommendations(organization_id, day_of_week, hour_of_day);

COMMENT ON TABLE booking_groups IS
  'Groups separate bookings from the same customer/device so additional reservations can be handled together.';
COMMENT ON TABLE customer_locations IS
  'Latest customer location snapshots used to calculate distance from the shop.';
COMMENT ON TABLE location_alerts IS
  'Queue proximity alerts to be sent through LINE when a customer is far away near their turn.';
COMMENT ON TABLE wait_time_forecasts IS
  'AI/heuristic wait-time prediction history.';
COMMENT ON TABLE staffing_recommendations IS
  'AI/heuristic staff-count recommendations by time slot.';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP TABLE IF EXISTS staffing_recommendations CASCADE;
DROP TABLE IF EXISTS wait_time_forecasts CASCADE;
DROP TABLE IF EXISTS location_alerts CASCADE;
DROP TABLE IF EXISTS customer_locations CASCADE;
ALTER TABLE orders
  DROP COLUMN IF EXISTS booking_group_id;
DROP TABLE IF EXISTS booking_groups CASCADE;
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_longitude_range,
  DROP CONSTRAINT IF EXISTS organizations_latitude_range,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude;
  `);
};
