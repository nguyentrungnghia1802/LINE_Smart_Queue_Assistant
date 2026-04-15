import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';

import {
  JoinQueueResult,
  QueueStatusResult,
  SkipTicketResult,
  TicketPositionResult,
} from './queue.types';
import { JoinQueueDto } from './queue.validator';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format a human-readable ticket code.
 * prefix="A", ticketNumber=5  → "A005"
 * prefix="",  ticketNumber=17 → "0017"
 */
function formatTicketDisplay(prefix: string, ticketNumber: number): string {
  const width = prefix ? 3 : 4;
  return `${prefix}${String(ticketNumber).padStart(width, '0')}`;
}

/** ETA = tickets waiting ahead × average service time per ticket. */
function calcEta(aheadCount: number, avgServiceSeconds: number): number {
  return aheadCount * avgServiceSeconds;
}

/**
 * Return the caller's active ticket in a specific queue, or null if they
 * have no active entry. Prefers userId lookup when available.
 */
async function findActiveEntry(
  userId: string | undefined,
  lineUserId: string | undefined,
  queueId: string
) {
  if (userId) {
    const byUser = await queueEntriesRepository.findActiveByUser(userId, queueId);
    if (byUser) return byUser;
  }
  if (lineUserId) {
    return queueEntriesRepository.findActiveByLineUser(lineUserId, queueId);
  }
  return null;
}

/**
 * Throw 403 Forbidden when the actor does not match the ticket's owner.
 * Ownership is satisfied if either userId or lineUserId matches.
 */
function assertOwnership(
  entry: { user_id: string | null; line_user_id: string | null },
  actorUserId?: string,
  actorLineUserId?: string
): void {
  const ownsById = actorUserId && entry.user_id === actorUserId;
  const ownsByLine = actorLineUserId && entry.line_user_id === actorLineUserId;
  if (!ownsById && !ownsByLine) {
    throw AppError.forbidden('You do not own this ticket');
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export const queueService = {
  /**
   * Join a queue and receive a numbered ticket.
   *
   * **Idempotency**: if the caller already holds an active ticket in this queue,
   * that ticket is returned unchanged with `isExisting: true`. Safe for retries.
   *
   * **Concurrency**: `incrementAndGetCounter` issues
   * `UPDATE queues SET daily_ticket_counter = counter + 1 RETURNING …` inside
   * the transaction. PostgreSQL's implicit row-level lock on the updated row
   * serialises concurrent joins, guaranteeing unique ticket numbers.
   *
   * **Capacity check** is optimistic (evaluated before the transaction).
   * Under extreme concurrency the queue could momentarily exceed `max_capacity`
   * by a small margin. Acceptable for MVP; add `SELECT … FOR UPDATE` inside
   * the transaction for strict enforcement.
   */
  async joinQueue(
    dto: JoinQueueDto & { userId?: string; lineUserId?: string }
  ): Promise<JoinQueueResult> {
    const { queueId, userId, lineUserId, notes } = dto;

    // 1. Load queue
    const queue = await queuesRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');

    // 2. Queue must be open
    if (queue.status !== 'open') {
      throw AppError.conflict(`Queue is not accepting entries (status: ${queue.status})`);
    }

    // 3. Idempotency — return existing active ticket unchanged
    const existing = await findActiveEntry(userId, lineUserId, queueId);
    if (existing) {
      const aheadCount = await queuesRepository.getWaitingPosition(
        queueId,
        existing.priority,
        existing.ticket_number
      );
      return {
        entry: existing,
        aheadCount,
        estimatedWaitSeconds: calcEta(aheadCount, queue.avg_service_seconds),
        isExisting: true,
      };
    }

    // 4. Capacity check (optimistic — see JSDoc above)
    if (queue.max_capacity !== null) {
      const waitingCount = await queuesRepository.countWaiting(queueId);
      if (waitingCount >= queue.max_capacity) {
        throw AppError.conflict('Queue is at full capacity');
      }
    }

    // 5. Atomically increment counter + insert entry inside a transaction
    const entry = await withTransaction(async (client) => {
      const ticketNumber = await queuesRepository.incrementAndGetCounter(queueId, client);
      const ticketDisplay = formatTicketDisplay(queue.prefix ?? '', ticketNumber);
      return queueEntriesRepository.create(
        { queueId, ticketNumber, ticketDisplay, userId, lineUserId, notes },
        client
      );
    });

    // 6. Position info (post-transaction read — acceptable eventual consistency)
    const aheadCount = await queuesRepository.getWaitingPosition(
      queueId,
      entry.priority,
      entry.ticket_number
    );

    return {
      entry,
      aheadCount,
      estimatedWaitSeconds: calcEta(aheadCount, queue.avg_service_seconds),
      isExisting: false,
    };
  },

  /**
   * Return all active tickets the caller holds across all queues,
   * each annotated with queue position and ETA.
   * Used on the "My Tickets" LIFF screen.
   */
  async getMyTickets(params: {
    userId?: string;
    lineUserId?: string;
  }): Promise<TicketPositionResult[]> {
    const { userId, lineUserId } = params;
    const entries = await queueEntriesRepository.findAllActiveForActor(userId, lineUserId);

    return Promise.all(
      entries.map(async (entry) => {
        const [aheadCount, queue] = await Promise.all([
          queuesRepository.getWaitingPosition(entry.queue_id, entry.priority, entry.ticket_number),
          queuesRepository.findById(entry.queue_id),
        ]);
        return {
          entry,
          aheadCount,
          estimatedWaitSeconds: queue ? calcEta(aheadCount, queue.avg_service_seconds) : 0,
        };
      })
    );
  },

  /** Public queue stats — no auth required. */
  async getQueueStatus(queueId: string): Promise<QueueStatusResult> {
    const queue = await queuesRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');

    const waitingCount = await queuesRepository.countWaiting(queueId);
    return {
      queue,
      waitingCount,
      estimatedWaitSeconds: calcEta(waitingCount, queue.avg_service_seconds),
    };
  },

  /**
   * Cancel a queue ticket.
   * The caller must own the ticket. Allowed for `waiting` and `called` entries.
   */
  async cancelTicket(params: {
    entryId: string;
    actorUserId?: string;
    actorLineUserId?: string;
  }): Promise<void> {
    const { entryId, actorUserId, actorLineUserId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    assertOwnership(entry, actorUserId, actorLineUserId);

    if (!['waiting', 'called'].includes(entry.status)) {
      throw AppError.conflict(`Ticket cannot be cancelled from status '${entry.status}'`);
    }

    await queueEntriesRepository.markCancelled(entryId);
  },

  /**
   * Customer self-service skip: push own ticket back one position.
   *
   * **Mechanics**: decrements `priority` by 1 and increments `skip_count`.
   * The ticket stays `waiting` but falls behind higher-priority entries.
   *
   * **Invariants**:
   * - `queue.allow_skip` must be `true`
   * - entry must be in `waiting` status
   * - `entry.skip_count < queue.max_skips_before_penalty`
   */
  async skipTicket(params: {
    entryId: string;
    actorUserId?: string;
    actorLineUserId?: string;
  }): Promise<SkipTicketResult> {
    const { entryId, actorUserId, actorLineUserId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    assertOwnership(entry, actorUserId, actorLineUserId);

    const queue = await queuesRepository.findById(entry.queue_id);
    if (!queue) throw AppError.notFound('Queue');

    if (!queue.allow_skip) {
      throw AppError.conflict('This queue does not allow skipping');
    }

    if (entry.status !== 'waiting') {
      throw AppError.conflict(`Cannot skip from status '${entry.status}' — ticket must be waiting`);
    }

    if (entry.skip_count >= queue.max_skips_before_penalty) {
      throw AppError.conflict(
        `Skip limit reached (${entry.skip_count}/${queue.max_skips_before_penalty})`
      );
    }

    const updated = await queueEntriesRepository.deprioritize(entryId);
    const aheadCount = await queuesRepository.getWaitingPosition(
      entry.queue_id,
      updated.priority,
      updated.ticket_number
    );

    return { entry: updated, aheadCount, skipCount: updated.skip_count };
  },
};

// Auxiliary re-exports so tests can import DTO types via this module
export type {
  CurrentQueueQuery,
  EntryIdParam,
  JoinQueueDto,
  QueueIdParam,
} from './queue.validator';
