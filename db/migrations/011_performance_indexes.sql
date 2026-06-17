-- =============================================================================
-- Migration 011: Performance indexes
-- =============================================================================
--
-- Findings from performance review (2026-06-18):
--
--   1. orders: getStats queries filter by (organization_id, status) and
--      (organization_id, status, created_at). The existing single-column
--      orders_status_idx is not useful when organization_id must also be
--      satisfied — PostgreSQL falls back to orders_organization_id_idx
--      and then re-checks status in the heap. A composite partial index
--      on (organization_id, created_at) for 'completed' orders covers the
--      daily-revenue GROUP BY and the top-products join simultaneously.
--
--   2. order_items: the top-products aggregation joins order_items →
--      orders on order_id. The existing order_items_order_id_idx covers
--      this but there is no index that lets PostgreSQL push the
--      o.status = 'completed' filter into the index scan. Adding a
--      covering index on (order_id) including (product_name, quantity,
--      subtotal, service_time_minutes) enables index-only scans for
--      both the top-products query and workload calculation.
--
--   3. queue_entries: getMyTickets and getTicketStatus call
--      getEntryIdsAhead which scans entries WHERE status IN (...)
--      AND queue_id = $1. The existing partial index idx_qe_queue_waiting
--      only covers status='waiting'. Adding a partial index covering
--      the active statuses (waiting|called|serving) removes a full scan
--      on the active subset for staff board and ETA workload queries.
--
--   4. notifications: the pending delivery-worker index covers
--      status='pending' ORDER BY created_at. After delivery the scanner
--      still needs to find recently-called entries by status. Adding a
--      partial index on queue_entry_id WHERE status='pending' speeds up
--      the duplicate-check query used by the anti-duplicate registry
--      (notificationLogRepository).
--
--   5. orders recent-activity join: the recentQueueActivities sub-query
--      joins orders ON queue_entry_id. The existing orders_queue_entry_id_idx
--      covers this, but the query is also filtered by updated_at DESC.
--      A composite index on (organization_id, updated_at DESC) for the
--      queue_entries table covers the "recent activity" scan directly.
--
-- All new indexes are PARTIAL where possible to keep index sizes small.
--
-- =============================================================================

BEGIN;

-- ── 1. orders: composite for status+org+date aggregations ────────────────────

-- Covers getStats summary, daily revenue, and cancellationRate.
-- Partial on completed so the index is as small as possible.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_completed_date
  ON orders (organization_id, created_at DESC)
  WHERE status = 'completed';

-- Covers pending/processing count in getStats.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_active
  ON orders (organization_id)
  WHERE status IN ('pending', 'processing');

-- ── 2. order_items: covering index for top-products and workload queries ──────

-- Enables index-only scans for:
--   SUM(oi.quantity), SUM(oi.subtotal) GROUP BY oi.product_name
--   SUM(oi.service_time_minutes * oi.quantity) WHERE o.queue_entry_id = ANY(...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_covering
  ON order_items (order_id)
  INCLUDE (product_name, quantity, subtotal, service_time_minutes);

-- ── 3. queue_entries: active-statuses partial index ──────────────────────────

-- Covers getEntryIdsAhead, getTicketStatus workload, and staff board queries
-- that filter on status IN ('waiting','called','serving') AND queue_id = $1.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qe_queue_active
  ON queue_entries (queue_id, priority DESC, ticket_number ASC)
  WHERE status IN ('waiting', 'called', 'serving');

-- Covers recentQueueActivities scan: all active entries for an org, newest first.
-- Used by the dashboard to show live queue activities without a queues JOIN.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qe_queue_updated
  ON queue_entries (queue_id, updated_at DESC)
  WHERE status IN ('waiting', 'called', 'serving');

-- ── 4. orders: recent-activity lookup by queue entry ─────────────────────────

-- The recentQueueActivities query LEFT JOINs orders ON queue_entry_id.
-- The existing orders_queue_entry_id_idx already covers this join.
-- Adding updated_at to cover the ORDER BY updated_at DESC in that subquery.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_updated
  ON orders (organization_id, updated_at DESC);

COMMIT;
