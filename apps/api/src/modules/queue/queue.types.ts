import { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { QueueRow } from '../../db/repositories/queues.repository';

// ── Result shapes returned by queueService ─────────────────────────────────────

/**
 * Returned when a user joins (or has already joined) a queue.
 *
 * `aheadCount` is 0 when the caller is next in line.
 * `isExisting` is true when the response is an idempotent return of a pre-existing ticket.
 */
export interface JoinQueueResult {
  entry: QueueEntryRow;
  /** Number of waiting entries ahead. 0 means next to be called. */
  aheadCount: number;
  /** aheadCount × queue.avg_service_seconds */
  estimatedWaitSeconds: number;
  isExisting: boolean;
}

/** Position snapshot for a single active ticket. */
export interface TicketPositionResult {
  entry: QueueEntryRow;
  aheadCount: number;
  estimatedWaitSeconds: number;
}

/** Public live stats for a queue. */
export interface QueueStatusResult {
  queue: QueueRow;
  waitingCount: number;
  estimatedWaitSeconds: number;
}

/** Result of a customer-initiated skip. */
export interface SkipTicketResult {
  entry: QueueEntryRow;
  aheadCount: number;
  skipCount: number;
}
