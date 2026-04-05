-- =============================================================================
-- Migration 001: Custom ENUM types
-- =============================================================================
-- All domain ENUMs are defined here first so every subsequent migration can
-- reference them safely.
--
-- Philosophy:
--   • Adding a value to an existing ENUM is non-destructive (ALTER TYPE … ADD VALUE).
--   • Renaming or removing a value requires a migration + app-layer backfill.
--   • If a value is only used in one table, consider a CHECK constraint instead.
-- =============================================================================

BEGIN;

-- ── Users & staff roles ───────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'customer',     -- end-user who joins queues via LINE / LIFF
  'staff',        -- org front-line staff (calls / serves tickets)
  'manager',      -- org manager (configures queues, views analytics)
  'admin',        -- org admin (manages members, full org control)
  'super_admin'   -- platform-level administrator
);

CREATE TYPE org_member_role AS ENUM (
  'owner',    -- created the org; full control
  'manager',  -- configure queues, manage staff schedules
  'staff'     -- operate queues (call, serve, skip tickets)
);

-- ── Queue lifecycle ───────────────────────────────────────────────────────────

CREATE TYPE queue_status AS ENUM (
  'closed',        -- not accepting entries (outside hours or manually closed)
  'open',          -- accepting entries and actively serving
  'paused',        -- temporarily not calling new numbers (staff break, overflow)
  'disaster_mode'  -- degraded operation: entries accepted, ETA suspended
);

CREATE TYPE queue_type AS ENUM (
  'walk_in',      -- arrive in person; first-come-first-served
  'appointment',  -- scheduled time slots (future: tie to calendar)
  'virtual'       -- remote queue; join via LINE without being on-site
);

-- ── Queue entry lifecycle ─────────────────────────────────────────────────────
--
-- Normal flow:   waiting → called → serving → completed
-- Skip flow:     waiting → called → skipped  → waiting (re-queued or penalty)
-- Abandon flows: waiting | called → cancelled  (voluntary)
--                called            → no_show    (grace period expired, no check-in)

CREATE TYPE entry_status AS ENUM (
  'waiting',    -- holding a ticket; waiting their turn
  'called',     -- their number was called; notification sent
  'serving',    -- checked in; service in progress
  'completed',  -- service finished successfully
  'skipped',    -- did not respond to call; may re-enter if skips < max
  'cancelled',  -- voluntarily left the queue
  'no_show'     -- did not respond past grace period; penalty may apply
);

-- ── Notification types & channels ────────────────────────────────────────────

CREATE TYPE notification_type AS ENUM (
  'position_update',   -- periodic "you are now #N in queue"
  'turn_approaching',  -- "only N positions ahead of you" (near-call alert)
  'called',            -- "your number is called — please proceed"
  'completed',         -- "service complete — thank you"
  'cancelled',         -- "your ticket has been cancelled"
  'penalty_warned',    -- "you have been warned; further skips incur penalty"
  'penalty_applied',   -- "a penalty has been applied to your account"
  'queue_paused',      -- broadcast: queue temporarily paused
  'queue_resumed',     -- broadcast: queue has resumed
  'queue_closed'       -- broadcast: queue is now closed for the day
);

CREATE TYPE notification_channel AS ENUM (
  'line_push',   -- LINE Messaging API push message (plain text)
  'line_flex',   -- LINE Flex Message (rich card with actions)
  'liff',        -- in-app notification rendered inside the LIFF page
  'in_app'       -- web dashboard notification (for staff)
);

CREATE TYPE notification_status AS ENUM (
  'pending',    -- queued for delivery
  'sent',       -- accepted by LINE API / transport layer
  'delivered',  -- delivery confirmed (where receipts are available)
  'failed',     -- delivery failed; see error_message column
  'skipped'     -- intentionally not sent (opt-out, duplicate suppression, etc.)
);

-- ── Penalty types & severity ──────────────────────────────────────────────────

CREATE TYPE penalty_type AS ENUM (
  'skip',     -- customer skipped their called number
  'no_show',  -- customer did not check in after grace period
  'abuse'     -- staff-applied manual penalty (queue jumping, misconduct)
);

CREATE TYPE penalty_severity AS ENUM (
  'warning',  -- informational; no functional restriction
  'minor',    -- short cooldown before re-joining
  'major',    -- longer restriction; may block re-entry to specific queue
  'ban'       -- cannot join this org's queues until expires_at (or forever)
);

-- ── Audit actor types ─────────────────────────────────────────────────────────

CREATE TYPE audit_actor_type AS ENUM (
  'user',     -- customer performing a self-service action (join, cancel)
  'staff',    -- org member performing an action (call, serve, skip)
  'system',   -- automated process (ETA updater, auto-close at closing time)
  'webhook',  -- incoming LINE webhook event (message, follow, unfollow)
  'cron'      -- scheduled job (daily counter reset, history archival, cleanup)
);

COMMIT;
