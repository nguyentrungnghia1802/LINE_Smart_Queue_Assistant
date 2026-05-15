BEGIN;

-- Add configurable no-show grace period (in minutes) per queue.
-- After a ticket is "called", if the customer does not check in within
-- this many minutes the system automatically marks it as no_show.
-- NULL = use the global fallback from application constants.
ALTER TABLE queues
  ADD COLUMN IF NOT EXISTS auto_no_show_minutes INT
    CONSTRAINT queues_auto_no_show_minutes_positive CHECK (auto_no_show_minutes IS NULL OR auto_no_show_minutes > 0);

COMMENT ON COLUMN queues.auto_no_show_minutes IS
  'Grace period in minutes before a called ticket is auto-marked no_show. NULL = use global default.';

COMMIT;
