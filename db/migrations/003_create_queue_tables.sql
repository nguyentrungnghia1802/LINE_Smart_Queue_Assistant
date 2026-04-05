-- =============================================================================
-- Migration 003: Queue management tables
-- =============================================================================
--
-- Tables created here:
--   queues         — a queue owned by an organization (1 org → N queues)
--   queue_entries  — one ticket per customer queue-join event (1 queue → N entries)
--
-- Relationship overview:
--
--   organizations ──< queues ──< queue_entries >── users
--
--   Multi-queue support:
--     An organization can have multiple simultaneous queues (counter A, counter B,
--     VIP lane, etc.). Each queue runs its own ticket counter and status.
--
--   Anonymous entry:
--     queue_entries.user_id is NULLABLE to support walk-in guests who have not
--     linked a LINE account. line_user_id is denormalized directly on the entry
--     so notification workers avoid joining users + line_accounts on every query.
--
-- ── ETA calculation strategy ──────────────────────────────────────────────────
--
--   Realtime position (query):
--     SELECT COUNT(*) FROM queue_entries
--     WHERE queue_id = $1 AND status = 'waiting'
--       AND (priority, ticket_number) < ($my_priority, $my_ticket_number)
--     -- ORDER: priority DESC, ticket_number ASC (higher priority served first)
--
--   ETA in seconds:
--     position * queues.avg_service_seconds
--
--   Snapshot ETA (for push notifications / LIFF display without per-request COUNT):
--     A background worker (cron / pg_notify listener) recalculates and writes
--     queue_entries.estimated_call_at for all waiting entries every N seconds.
--     The LIFF page reads this column directly — O(1) per request.
--
-- ── Priority queue design ─────────────────────────────────────────────────────
--
--   priority = 0   → normal customer
--   priority > 0   → VIP / accessibility / staff override (called earlier)
--   priority < 0   → deprioritised (e.g. after re-queue from skip, reduced by 1)
--
--   Ordering: ORDER BY priority DESC, ticket_number ASC
--
-- ── Ticket numbering ──────────────────────────────────────────────────────────
--
--   ticket_number   — INT incremented from queues.daily_ticket_counter per day.
--                     UNIQUE (queue_id, ticket_number).
--   ticket_display  — human-readable: prefix || '-' || lpad(ticket_number::text, 3, '0')
--                     e.g. 'A-042', 'VIP-007', '-001' (no prefix)
--   daily_ticket_counter reset at midnight by cron (logs to audit_logs).
--
-- =============================================================================

BEGIN;

-- ── queues ────────────────────────────────────────────────────────────────────

CREATE TABLE queues (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  name                      TEXT         NOT NULL,   -- "Counter A", "VIP Lane", "Walk-in"
  description               TEXT,

  -- Lifecycle
  status                    queue_status NOT NULL DEFAULT 'closed',
  queue_type                queue_type   NOT NULL DEFAULT 'walk_in',

  -- Ticket display prefix: '' → '001', 'A' → 'A-001', 'VIP' → 'VIP-001'
  prefix                    TEXT         NOT NULL DEFAULT '',

  -- Capacity limits (NULL = unlimited)
  max_capacity              INT,

  -- Daily counter: monotonically incremented; reset to 0 at midnight by cron
  daily_ticket_counter      INT          NOT NULL DEFAULT 0,
  last_counter_reset_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- ETA: average seconds of service per ticket (editable by manager)
  avg_service_seconds       INT          NOT NULL DEFAULT 300,   -- default 5 min

  -- Notification threshold: alert customer when this many entries remain ahead
  notify_ahead_positions    INT          NOT NULL DEFAULT 3,

  -- Skip / penalty configuration
  allow_skip                BOOLEAN      NOT NULL DEFAULT TRUE,
  max_skips_before_penalty  INT          NOT NULL DEFAULT 2,

  -- Optional schedule: NULL = manually open/close only
  opens_at                  TIME,
  closes_at                 TIME,

  -- Flexible extra config (LIFF URL, service category list, intake form fields…)
  settings                  JSONB        NOT NULL DEFAULT '{}',

  is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT queues_max_capacity_positive       CHECK (max_capacity IS NULL OR max_capacity > 0),
  CONSTRAINT queues_avg_service_seconds_pos     CHECK (avg_service_seconds > 0),
  CONSTRAINT queues_notify_ahead_positive       CHECK (notify_ahead_positions > 0),
  CONSTRAINT queues_max_skips_non_negative      CHECK (max_skips_before_penalty >= 0),
  CONSTRAINT queues_daily_counter_non_negative  CHECK (daily_ticket_counter >= 0),
  -- prefix: up to 5 alphanumeric chars (empty string allowed)
  CONSTRAINT queues_prefix_format               CHECK (prefix ~ '^[A-Za-z0-9]{0,5}$'),
  -- if both hours are set, opens must be before closes
  CONSTRAINT queues_hours_valid                 CHECK (
    opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at
  )
);

CREATE TRIGGER trg_queues_updated_at
  BEFORE UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── queue_entries ─────────────────────────────────────────────────────────────

CREATE TABLE queue_entries (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id          UUID         NOT NULL REFERENCES queues(id) ON DELETE RESTRICT,

  -- Identity
  -- user_id NULL:     anonymous walk-in (no LINE account linked yet)
  -- line_user_id:     denormalized from line_accounts for fast notification lookup
  user_id           UUID         REFERENCES users(id) ON DELETE SET NULL,
  line_user_id      TEXT,

  -- Ticket
  -- ticket_number incremented from queues.daily_ticket_counter (app layer atomically:
  --   UPDATE queues SET daily_ticket_counter = daily_ticket_counter + 1 … RETURNING …)
  ticket_number     INT          NOT NULL,
  ticket_display    TEXT         NOT NULL,   -- e.g. 'A-042'

  -- Status
  status            entry_status NOT NULL DEFAULT 'waiting',

  -- Skip tracking: incremented each time called→skipped transition occurs.
  -- When skip_count >= queues.max_skips_before_penalty, a penalty_record is created.
  skip_count        SMALLINT     NOT NULL DEFAULT 0,

  -- Priority: 0=normal. Staff can set >0 to serve out of order (VIP, accessibility).
  -- Re-queued entries after a skip may receive priority = priority - 1.
  priority          SMALLINT     NOT NULL DEFAULT 0,

  -- Staff remarks (not visible to the customer via LIFF)
  notes             TEXT,

  -- Custom intake data (party_size, service_type, special_requirements…)
  metadata          JSONB        NOT NULL DEFAULT '{}',

  -- Lifecycle timestamps — NULL until that state is first entered.
  -- Timestamps are never overwritten once set (immutable after first write).
  called_at         TIMESTAMPTZ,   -- when status changed waiting → called
  serving_at        TIMESTAMPTZ,   -- when status changed called  → serving
  completed_at      TIMESTAMPTZ,   -- when status changed serving → completed
  skipped_at        TIMESTAMPTZ,   -- when status changed called  → skipped
  cancelled_at      TIMESTAMPTZ,   -- when status changed *       → cancelled

  -- ETA snapshot written by background worker; stale by at most worker interval.
  -- NULL = not yet calculated or queue is paused/disaster_mode.
  estimated_call_at TIMESTAMPTZ,

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A ticket number must be unique within a queue on a given day.
  -- (daily_ticket_counter reset means numbers repeat across days — acceptable
  --  because entries are archived to queue_histories after reaching terminal status.)
  CONSTRAINT queue_entries_ticket_unique      UNIQUE  (queue_id, ticket_number),

  CONSTRAINT queue_entries_skip_non_negative  CHECK   (skip_count >= 0),
  CONSTRAINT queue_entries_priority_range     CHECK   (priority BETWEEN -10 AND 10),

  -- Lifecycle consistency: if status has advanced past a stage,
  -- the corresponding timestamp must be populated.
  CONSTRAINT queue_entries_called_at_set      CHECK (
    status NOT IN ('called', 'serving', 'completed', 'skipped', 'no_show')
    OR called_at IS NOT NULL
  ),
  CONSTRAINT queue_entries_serving_at_set     CHECK (
    status NOT IN ('serving', 'completed')
    OR serving_at IS NOT NULL
  ),
  CONSTRAINT queue_entries_completed_at_set   CHECK (
    status <> 'completed'
    OR completed_at IS NOT NULL
  )
);

CREATE TRIGGER trg_queue_entries_updated_at
  BEFORE UPDATE ON queue_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
