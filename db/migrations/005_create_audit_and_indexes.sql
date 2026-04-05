-- =============================================================================
-- Migration 005: Audit log + performance indexes
-- =============================================================================
--
-- audit_logs  — append-only immutable event trail (no UPDATE/DELETE ever)
-- Indexes     — partial indexes targeting the hottest query paths
--
-- ── Audit log design ──────────────────────────────────────────────────────────
--
--   Uses BIGSERIAL PK (not UUID) for maximum single-node insert throughput and
--   natural time-ordering without a secondary sort column.
--
--   organization_id is denormalized (no FK) so compliance queries like
--   "all events for org X in the last 30 days" are fast even if queues/entries
--   referencing that org have been deleted.
--
--   changes JSONB stores {old: {...}, new: {...}} diffs written by app layer.
--   The app should only write changed fields, not full row snapshots.
--
--   Enforcement: INSERT-only policy.
--   Apply at the DB level with separate app role:
--     REVOKE UPDATE, DELETE ON audit_logs FROM app_role;
--
-- ── Index strategy ────────────────────────────────────────────────────────────
--
--   All hot-path indexes are PARTIAL (WHERE clause) to minimize index size:
--     • idx_qe_queue_waiting    — only 'waiting' rows (small fraction of total)
--     • idx_qe_user_active      — only active rows per user
--     • idx_notif_pending       — only the delivery queue (shrinks as workers run)
--     • idx_penalty_user_active — only active penalties (most expire quickly)
--
--   Full indexes only where the entire table is queried:
--     • line_accounts, organization_members — small tables, full scans are fine
--       but indexes prevent sequential scans at scale.
--
-- =============================================================================

BEGIN;

-- ── audit_logs ────────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  -- BIGSERIAL gives natural time order + max insert throughput for high-volume events
  id               BIGSERIAL         PRIMARY KEY,

  -- actor_id NULL for cron / system-generated events
  actor_id         UUID,
  actor_type       audit_actor_type  NOT NULL DEFAULT 'user',

  -- Dot-namespaced action: "queue_entry.called", "penalty.applied", "queue.opened"
  action           TEXT              NOT NULL,

  -- Resource that was mutated: "queue_entry", "penalty_record", "queue", "user"
  resource_type    TEXT              NOT NULL,
  resource_id      UUID,

  -- Denormalized: enables org-scoped compliance queries without joining other tables.
  -- No FK intentionally — org may be deleted but audit rows must be preserved.
  organization_id  UUID,

  -- {old: { status: "waiting" }, new: { status: "called", called_at: "..." }}
  -- Only changed fields; not full row snapshots.
  changes          JSONB,

  -- Request context (logged at the HTTP layer before the DB write)
  ip_address       INET,
  user_agent       TEXT,

  -- Immutable timestamp — never updated after insert
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
  -- intentionally no updated_at
);

-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║  INDEXES
-- ╚══════════════════════════════════════════════════════════════════════════════

-- ── queue_entries: ETA & position queries (hottest path) ─────────────────────

-- "What is my current position in queue X?"
-- "Get all waiting entries ordered by priority then arrival order."
-- Partial on status='waiting': index stays tiny as entries complete.
-- Covers: get_position(), update_eta_snapshot(), staff queue board.
CREATE INDEX idx_qe_queue_waiting
  ON queue_entries (queue_id, priority DESC, ticket_number ASC)
  WHERE status = 'waiting';

-- "Does this user already have an active ticket in queue X?"
-- Used before allowing a new join (prevent duplicate entries).
-- Also: "Show the customer their current ticket."
CREATE INDEX idx_qe_user_active
  ON queue_entries (user_id, queue_id)
  WHERE status IN ('waiting', 'called', 'serving');

-- "Find active entry by LINE user ID" — auth flow bypasses users/line_accounts join.
-- The webhook handler runs this on every incoming LINE message.
CREATE INDEX idx_qe_line_user_active
  ON queue_entries (line_user_id, queue_id)
  WHERE status IN ('waiting', 'called', 'serving');

-- Background ETA worker: scan all waiting entries for a queue, oldest first.
-- Separate from idx_qe_queue_waiting to avoid DESC/ASC conflict on ticket_number.
CREATE INDEX idx_qe_eta_worker
  ON queue_entries (queue_id, created_at ASC)
  WHERE status = 'waiting';

-- ── queues: org dashboard & LIFF home ────────────────────────────────────────

-- "Show all open queues for organization X" (LIFF home page, staff dashboard)
CREATE INDEX idx_queues_org_active
  ON queues (organization_id, status)
  WHERE is_active = TRUE;

-- ── line_accounts: webhook handler resolution ────────────────────────────────

-- "Resolve incoming LINE userId → our users row" (every webhook event)
CREATE INDEX idx_la_line_user_id
  ON line_accounts (line_user_id);

-- "Fetch LINE profile for a known user" (notification worker, profile sync)
CREATE INDEX idx_la_user_id
  ON line_accounts (user_id);

-- ── organization_members: auth middleware ─────────────────────────────────────

-- "What organizations does this user belong to?" (staff login, permission check)
CREATE INDEX idx_om_user_id
  ON organization_members (user_id);

-- ── notifications: delivery worker & rate-limiter ────────────────────────────

-- Delivery worker polls: "give me the next N pending notifications"
CREATE INDEX idx_notif_pending
  ON notifications (created_at ASC)
  WHERE status = 'pending';

-- "Show notification history for this queue entry" (debug panel)
CREATE INDEX idx_notif_entry
  ON notifications (queue_entry_id, created_at DESC);

-- Rate-limit guard: "how many messages did we send to user X in the last hour?"
CREATE INDEX idx_notif_user_recent
  ON notifications (user_id, created_at DESC)
  WHERE status IN ('sent', 'delivered');

-- ── penalty_records: pre-join check & staff panel ────────────────────────────

-- "Does this user have an active ban before allowing them to join?"
-- Partial on active penalties only: most penalties are historical (is_active=FALSE).
CREATE INDEX idx_penalty_user_active
  ON penalty_records (user_id, severity, expires_at)
  WHERE is_active = TRUE;

-- Staff penalty panel: "show all penalties for user X in this org"
CREATE INDEX idx_penalty_org_user
  ON penalty_records (organization_id, user_id, applied_at DESC);

-- ── queue_histories: analytics ────────────────────────────────────────────────

-- Org-level aggregate: daily / weekly traffic, avg wait time per org
CREATE INDEX idx_qh_org_date
  ON queue_histories (organization_id, archived_at DESC);

-- Queue-level aggregate: per-queue throughput, peak hours histogram
CREATE INDEX idx_qh_queue_date
  ON queue_histories (queue_id, archived_at DESC);

-- Customer history: "show my past visits" (LIFF history page)
CREATE INDEX idx_qh_user_date
  ON queue_histories (user_id, archived_at DESC)
  WHERE user_id IS NOT NULL;

-- ── audit_logs: compliance & support drill-down ───────────────────────────────

-- "Show all events that touched resource X" (admin incident investigation)
CREATE INDEX idx_audit_resource
  ON audit_logs (resource_type, resource_id, created_at DESC);

-- "Show all events for org X" (org-level compliance export)
CREATE INDEX idx_audit_org
  ON audit_logs (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- "Show all actions by actor X" (user activity audit)
CREATE INDEX idx_audit_actor
  ON audit_logs (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

COMMIT;
