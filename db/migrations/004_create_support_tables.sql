-- =============================================================================
-- Migration 004: Supporting tables
-- =============================================================================
--
-- Tables created here:
--   notifications    — outbox log of every message sent/attempted to customers/staff
--   penalty_records  — skip / no-show / abuse penalties accumulated per user
--   queue_histories  — immutable analytics archive written when an entry resolves
--
-- Relationship overview:
--
--   queue_entries ──< notifications >── users
--     Every outbound LINE push / Flex message is logged here.
--     queue_entry_id is SET NULL on entry deletion (entries kept long-term anyway).
--
--   users ──< penalty_records
--     organizations ──────────────────< penalty_records   (nullable: global penalty)
--     queues ─────────────────────────< penalty_records   (nullable: queue-specific)
--     queue_entries ───────────────────< penalty_records  (nullable: triggering entry)
--
--   queues ──< queue_histories
--   organizations ──< queue_histories
--     Append-only snapshot written on terminal status (completed/cancelled/no_show).
--     user_id and line_user_id are copied at archive time and preserved even if
--     the original users row is later deleted (GDPR: anonymise, do not purge stats).
--
-- =============================================================================

BEGIN;

-- ── notifications ─────────────────────────────────────────────────────────────
-- Written by notification workers; never mutated after delivery attempt.
-- Rows transition: pending → sent → delivered|failed   (each state written once)
--
-- Use cases:
--   1. Delivery tracking & retry (worker polls WHERE status='pending')
--   2. Debug: inspect payload for failed messages
--   3. Rate-limit guard: count recent rows per user before sending another
--   4. Audit: full record of every message the platform sent
--
-- No updated_at: rows are effectively immutable after status is set.

CREATE TABLE notifications (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: entry may be archived / row may be pruned; we still keep the log.
  queue_entry_id  UUID                  REFERENCES queue_entries(id) ON DELETE SET NULL,

  user_id         UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type            notification_type     NOT NULL,
  channel         notification_channel  NOT NULL DEFAULT 'line_push',
  status          notification_status   NOT NULL DEFAULT 'pending',

  -- Full message body stored for audit / replay (LINE Flex JSON, plain text, etc.)
  payload         JSONB                 NOT NULL DEFAULT '{}',

  -- Populated only on failure; e.g. "LINE API 429 Too Many Requests"
  error_message   TEXT,

  sent_at         TIMESTAMPTZ,          -- when delivery was attempted
  delivered_at    TIMESTAMPTZ,          -- when delivery was confirmed (if available)

  created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
  -- intentionally no updated_at
);

-- ── penalty_records ───────────────────────────────────────────────────────────
-- Tracks skip / no-show / abuse penalties per customer.
--
-- Penalty lifecycle:
--   1. Customer skips: skip_count++  on queue_entries.
--   2. If skip_count >= queues.max_skips_before_penalty → create penalty_record.
--   3. Severity escalates with repeat offences (app logic, not DB constraint).
--   4. is_active=TRUE means the penalty is currently in effect.
--   5. expires_at=NULL means permanent (requires staff to manually deactivate).
--   6. is_active=FALSE means expired or lifted by staff.
--
-- Scope rules:
--   organization_id NULL → platform-wide penalty (all orgs affected)
--   organization_id SET, queue_id NULL → org-wide (all queues in that org)
--   queue_id SET → queue-specific restriction
--
-- created_by: the staff member who applied a manual 'abuse' penalty.
--             NULL for system-generated skip/no_show penalties (actor_type=system).

CREATE TABLE penalty_records (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID             NOT NULL REFERENCES users(id)         ON DELETE CASCADE,

  -- Nullable FK: penalty persists in history even if org/queue is later deleted.
  organization_id  UUID             REFERENCES organizations(id) ON DELETE SET NULL,
  queue_id         UUID             REFERENCES queues(id)        ON DELETE SET NULL,
  queue_entry_id   UUID             REFERENCES queue_entries(id) ON DELETE SET NULL,

  type             penalty_type     NOT NULL,
  severity         penalty_severity NOT NULL DEFAULT 'warning',

  is_active        BOOLEAN          NOT NULL DEFAULT TRUE,
  applied_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,     -- NULL = permanent until staff deactivates

  notes            TEXT,            -- reason / internal notes (staff-visible only)
  created_by       UUID             REFERENCES users(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT penalty_expires_after_applied CHECK (
    expires_at IS NULL OR expires_at > applied_at
  )
);

-- ── queue_histories ───────────────────────────────────────────────────────────
-- Append-only analytics archive. Written (by app or trigger) when a queue_entry
-- reaches a terminal status: completed, cancelled, no_show.
-- NEVER deleted — used for aggregate analytics and user history.
--
-- Why not just query queue_entries?
--   • Active table stays small (only open/called/serving tickets).
--   • Analytics queries on months of data run against this table with no
--     impact on the hot path.
--   • User identity is preserved here even after GDPR anonymisation of users.
--
-- Derived durations calculated at archive time (not recomputed each query):
--   waited_seconds  = EXTRACT(EPOCH FROM (serving_at   - created_at))   NULL if never served
--   served_seconds  = EXTRACT(EPOCH FROM (completed_at - serving_at))   NULL if not completed
--
-- queue_entry_id is a soft reference: the original row may be pruned
-- after archiving, so no FK + ON DELETE RESTRICT.

CREATE TABLE queue_histories (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id   UUID,                      -- soft ref; may be NULL after entry pruned

  -- Hard references: queues and orgs are never deleted (ON DELETE RESTRICT)
  queue_id         UUID         NOT NULL REFERENCES queues(id)        ON DELETE RESTRICT,
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  -- Denormalized identity — preserved for analytics even if user row is later
  -- anonymised (GDPR: null out PII in users row; historical stats remain intact)
  user_id          UUID,
  line_user_id     TEXT,

  -- Ticket snapshot
  ticket_number    INT          NOT NULL,
  ticket_display   TEXT         NOT NULL,
  final_status     entry_status NOT NULL,
  skip_count       SMALLINT     NOT NULL DEFAULT 0,

  -- Derived durations (seconds; NULL if the stage was never reached)
  waited_seconds   INT,
  served_seconds   INT,

  -- Copy of entry metadata (service_type, party_size, etc. for breakdown analytics)
  metadata         JSONB        NOT NULL DEFAULT '{}',

  -- created_at = original queue_entry.created_at (NOT the archive timestamp)
  -- This is the "customer arrived" timestamp used for hourly demand histograms.
  created_at       TIMESTAMPTZ  NOT NULL,
  archived_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMIT;
