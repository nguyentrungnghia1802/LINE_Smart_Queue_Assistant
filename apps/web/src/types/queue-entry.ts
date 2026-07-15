/**
 * Frontend types for the 4 MVP queue entry endpoints.
 *
 * These match the snake_case JSON shapes returned by the API
 * (the backend serialises raw DB row fields without transformation).
 *
 * See apps/api/src/modules/queue/queue.types.ts for the source of truth.
 */

import type { TicketStatus } from '@line-queue/shared';

// ── Queue entry (ticket) ───────────────────────────────────────────────────

export interface QueueEntryDisplay {
  id: string;
  queue_id: string;
  user_id: string | null;
  order_id: string | null;
  line_user_id: string | null;
  ticket_number: number;
  ticket_code: string;
  status: TicketStatus;
  priority: number;
  position_snapshot: number | null;
  estimated_wait_seconds: number | null;
  called_at: string | null;
  serving_started_at: string | null;
  served_at: string | null;
  skipped_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Queue info (public summary) ────────────────────────────────────────────

export interface QueueDisplay {
  id: string;
  name: string;
  description: string | null;
  status: string; // 'open' | 'closed' | 'paused' | 'disaster_mode'
  prefix: string;
  avg_service_seconds: number;
  max_capacity: number | null;
  allow_skip: boolean;
}

// ── API response payloads ──────────────────────────────────────────────────

/** POST /api/v1/queue/join */
export interface JoinQueueResult {
  entry: QueueEntryDisplay;
  aheadCount: number;
  estimatedWaitSeconds: number;
  isExisting: boolean;
}

/** One item in GET /api/v1/queue/me */
export interface TicketPositionResult {
  entry: QueueEntryDisplay;
  aheadCount: number;
  estimatedWaitSeconds: number;
}

/** GET /api/v1/queue/:queueId/status and GET /api/v1/queue/current */
export interface QueueStatusResult {
  queue: QueueDisplay;
  waitingCount: number;
  estimatedWaitSeconds: number;
}

// ── Join form input ────────────────────────────────────────────────────────

export interface JoinQueueInput {
  queueId: string;
  notes?: string;
}
