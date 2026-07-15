module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql(String.raw`
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'queue_serving';

ALTER TABLE notifications
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN event_key TEXT,
  ADD COLUMN event_type TEXT,
  ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN max_attempts INT NOT NULL DEFAULT 5,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT;

UPDATE notifications
SET event_type = COALESCE(event_type, type::text),
    event_key = COALESCE(
      event_key,
      CONCAT('legacy:', id::text, ':', type::text)
    );

ALTER TABLE notifications
  ALTER COLUMN event_key SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ADD CONSTRAINT notifications_event_key_unique UNIQUE (event_key),
  ADD CONSTRAINT notifications_attempt_count_non_negative CHECK (attempt_count >= 0),
  ADD CONSTRAINT notifications_max_attempts_positive CHECK (max_attempts > 0);

CREATE INDEX idx_notif_org_recent ON notifications(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX idx_notif_due_line_outbox ON notifications(next_retry_at, created_at)
  WHERE channel = 'line_push' AND status = 'pending';
CREATE INDEX idx_notif_entry_event ON notifications(queue_entry_id, event_type)
  WHERE queue_entry_id IS NOT NULL;
  `);
};

module.exports.down = async (pgm) => {
  pgm.sql(String.raw`
DROP INDEX IF EXISTS idx_notif_entry_event;
DROP INDEX IF EXISTS idx_notif_due_line_outbox;
DROP INDEX IF EXISTS idx_notif_org_recent;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_max_attempts_positive,
  DROP CONSTRAINT IF EXISTS notifications_attempt_count_non_negative,
  DROP CONSTRAINT IF EXISTS notifications_event_key_unique,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS max_attempts,
  DROP COLUMN IF EXISTS attempt_count,
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS event_key,
  DROP COLUMN IF EXISTS organization_id;
  `);
};
