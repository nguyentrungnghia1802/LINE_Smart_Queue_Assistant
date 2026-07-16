module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'location_warning';

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
  CONSTRAINT line_preferences_consent_source CHECK (
    consent_source IS NULL OR consent_source IN ('line_follow','liff_settings','legacy_link')
  )
);
CREATE TRIGGER trg_line_notification_preferences_updated_at
BEFORE UPDATE ON line_notification_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO line_notification_preferences
  (user_id, line_user_id, follow_state, notification_enabled, consented_at, consent_source)
SELECT user_id, line_user_id,
       CASE WHEN is_linked THEN 'followed' ELSE 'unfollowed' END,
       is_linked, linked_at, 'legacy_link'
FROM line_accounts
ON CONFLICT (user_id) DO NOTHING;

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
  CONSTRAINT location_consent_source CHECK (
    consent_source IS NULL OR consent_source IN ('liff_booking','liff_settings')
  )
);
CREATE TRIGGER trg_customer_location_consents_updated_at
BEFORE UPDATE ON customer_location_consents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customer_locations
  ADD COLUMN consent_user_id UUID REFERENCES customer_location_consents(user_id) ON DELETE SET NULL,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN anonymized_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE location_alerts
  ADD COLUMN event_key TEXT,
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN next_retry_at TIMESTAMPTZ,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT;

UPDATE location_alerts SET event_key = CONCAT('location_alert:', id::text) WHERE event_key IS NULL;
ALTER TABLE location_alerts
  ALTER COLUMN event_key SET NOT NULL,
  ADD CONSTRAINT location_alerts_event_key_unique UNIQUE (event_key),
  ADD CONSTRAINT location_alerts_attempt_non_negative CHECK (attempt_count >= 0);

CREATE INDEX idx_line_preferences_delivery
  ON line_notification_preferences(line_user_id)
  WHERE notification_enabled = TRUE AND follow_state = 'followed';
CREATE INDEX idx_customer_locations_expiry
  ON customer_locations(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_location_alerts_delivery_due
  ON location_alerts(next_retry_at, due_at)
  WHERE status = 'pending';
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP INDEX IF EXISTS idx_location_alerts_delivery_due;
DROP INDEX IF EXISTS idx_customer_locations_expiry;
DROP INDEX IF EXISTS idx_line_preferences_delivery;
ALTER TABLE location_alerts
  DROP CONSTRAINT IF EXISTS location_alerts_attempt_non_negative,
  DROP CONSTRAINT IF EXISTS location_alerts_event_key_unique,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS event_key;
ALTER TABLE customer_locations
  ALTER COLUMN longitude SET NOT NULL,
  ALTER COLUMN latitude SET NOT NULL,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS anonymized_at,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS consent_user_id;
DROP TABLE IF EXISTS customer_location_consents;
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_manual_retry_non_negative,
  DROP COLUMN IF EXISTS operator_note,
  DROP COLUMN IF EXISTS manual_retry_count;
DROP TABLE IF EXISTS line_notification_preferences;
  `);
};
