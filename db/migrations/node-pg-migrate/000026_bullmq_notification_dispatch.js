/* eslint-disable no-undef */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(String.raw`
    ALTER TABLE notifications
      ADD COLUMN dispatch_status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN dispatch_attempt_count INT NOT NULL DEFAULT 0,
      ADD COLUMN dispatch_next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN dispatch_started_at TIMESTAMPTZ,
      ADD COLUMN dispatch_job_id TEXT,
      ADD COLUMN dispatched_at TIMESTAMPTZ,
      ADD COLUMN dispatch_last_error TEXT,
      ADD COLUMN processing_job_id TEXT,
      ADD CONSTRAINT notifications_dispatch_status_supported CHECK (
        dispatch_status IN ('pending', 'dispatching', 'dispatched')
      ),
      ADD CONSTRAINT notifications_dispatch_attempt_non_negative CHECK (
        dispatch_attempt_count >= 0
      );

    CREATE INDEX idx_notifications_dispatch_due
      ON notifications(dispatch_next_retry_at, created_at)
      WHERE channel = 'line_push'
        AND status = 'pending'
        AND dispatch_status = 'pending';

    CREATE INDEX idx_notifications_dispatch_claim_recovery
      ON notifications(dispatch_started_at)
      WHERE channel = 'line_push'
        AND status = 'pending'
        AND dispatch_status = 'dispatching';
  `);
};

exports.down = (pgm) => {
  pgm.sql(String.raw`
    DROP INDEX IF EXISTS idx_notifications_dispatch_claim_recovery;
    DROP INDEX IF EXISTS idx_notifications_dispatch_due;

    ALTER TABLE notifications
      DROP CONSTRAINT IF EXISTS notifications_dispatch_attempt_non_negative,
      DROP CONSTRAINT IF EXISTS notifications_dispatch_status_supported,
      DROP COLUMN IF EXISTS processing_job_id,
      DROP COLUMN IF EXISTS dispatch_last_error,
      DROP COLUMN IF EXISTS dispatched_at,
      DROP COLUMN IF EXISTS dispatch_job_id,
      DROP COLUMN IF EXISTS dispatch_started_at,
      DROP COLUMN IF EXISTS dispatch_next_retry_at,
      DROP COLUMN IF EXISTS dispatch_attempt_count,
      DROP COLUMN IF EXISTS dispatch_status;
  `);
};
