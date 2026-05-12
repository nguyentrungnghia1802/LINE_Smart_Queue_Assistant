import { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { etaService } from '../eta/eta.service';
import type { ILineMessagingAdapter } from '../line/line.adapter';
import type { INotificationLogRepository } from '../notifications/notification-log.repository';
import { queueNotificationService } from '../notifications/queue-notification.service';
import { skipPenaltyService } from '../skip-penalty/skip-penalty.service';

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
        estimatedWaitSeconds: etaService.calculate({
          aheadCount,
          avgServiceSeconds: queue.avg_service_seconds,
        }).estimatedWaitSeconds,
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

    // 5. Calculate join-time priority adjustment from active penalties
    const priorityAdjustment = userId
      ? await skipPenaltyService
          .calculatePriorityAdjustment({ userId, organizationId: queue.organization_id })
          .catch(() => 0)
      : 0;

    // 6. Atomically increment counter + insert entry inside a transaction
    const entry = await withTransaction(async (client) => {
      const ticketNumber = await queuesRepository.incrementAndGetCounter(queueId, client);
      const ticketDisplay = formatTicketDisplay(queue.prefix ?? '', ticketNumber);
      return queueEntriesRepository.create(
        {
          queueId,
          ticketNumber,
          ticketDisplay,
          userId,
          lineUserId,
          notes,
          priority: priorityAdjustment !== 0 ? priorityAdjustment : undefined,
        },
        client
      );
    });

    // 7. Position info (post-transaction read — acceptable eventual consistency)
    const aheadCount = await queuesRepository.getWaitingPosition(
      queueId,
      entry.priority,
      entry.ticket_number
    );

    return {
      entry,
      aheadCount,
      estimatedWaitSeconds: etaService.calculate({
        aheadCount,
        avgServiceSeconds: queue.avg_service_seconds,
      }).estimatedWaitSeconds,
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
          estimatedWaitSeconds: queue
            ? etaService.calculate({
                aheadCount,
                avgServiceSeconds: queue.avg_service_seconds,
              }).estimatedWaitSeconds
            : 0,
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
      estimatedWaitSeconds: etaService.calculate({
        aheadCount: waitingCount,
        avgServiceSeconds: queue.avg_service_seconds,
      }).estimatedWaitSeconds,
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

    const updated = await queueEntriesRepository.deprioritize(entryId);

    // Record a skip penalty when the customer has exhausted their skip allowance.
    // Fire-and-forget — a penalty-write failure must not block the queue operation.
    if (entry.user_id && updated.skip_count >= queue.max_skips_before_penalty) {
      void skipPenaltyService
        .onSkipExhausted({
          userId: entry.user_id,
          queueId: entry.queue_id,
          entryId: entry.id,
          organizationId: queue.organization_id,
        })
        .catch((err: unknown) => logger.warn({ err }, 'skip-penalty: onSkipExhausted failed'));
    }

    const aheadCount = await queuesRepository.getWaitingPosition(
      entry.queue_id,
      updated.priority,
      updated.ticket_number
    );

    return { entry: updated, aheadCount, skipCount: updated.skip_count };
  },

  // ── Staff operations ─────────────────────────────────────────────────────────

  /**
   * Call the next waiting ticket in a queue.
   *
   * **State transition**: waiting → called (atomic UPDATE … WHERE status='waiting').
   * Concurrent calls are safe: the first UPDATE wins; subsequent callers for the
   * same entry get a 409 from markCalled's RETURNING guard.
   *
   * **Notifications** (fire-and-forget):
   * 1. Push "your turn" to the called ticket holder.
   * 2. Push "almost your turn" ETA warning to the entry now at position 2
   *    (if they have a LINE account and haven't been warned yet).
   *
   * Both notification calls are non-blocking — a notification failure never
   * rolls back the queue state transition.
   *
   * @param adapter  Injectable LINE adapter — defaults to production singleton.
   *                 Pass a MockLineAdapter in tests.
   * @param log      Injectable notification log — defaults to in-memory registry.
   *                 Pass a fresh mock registry in tests.
   */
  async callNextTicket(
    queueId: string,
    adapter?: ILineMessagingAdapter,
    log?: INotificationLogRepository
  ): Promise<QueueEntryRow> {
    const queue = await queuesRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');

    const waiting = await queueEntriesRepository.listWaiting(queueId);
    if (waiting.length === 0) {
      throw AppError.conflict('No waiting entries in this queue');
    }

    const [next, nextUp] = waiting;

    // Atomic status transition — throws if entry was concurrently moved.
    const called = await queueEntriesRepository.markCalled(next.id);

    // Fire-and-forget: failures are logged but must not block the response
    // or raise to the caller.
    void queueNotificationService.notifyTicketCalled(called, adapter, log);

    // Warn the entry now at position 1 (was position 2 before calling `next`).
    if (nextUp) {
      void queueNotificationService.notifyEtaWarning(nextUp, 1, adapter, log);
    }

    return called;
  },

  /**
   * Mark a called ticket as serving (customer has reached the counter).
   * Requires the entry to be in `called` status.
   */
  async serveTicket(params: { entryId: string; actorUserId?: string }): Promise<QueueEntryRow> {
    const { entryId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    if (entry.status !== 'called') {
      throw AppError.conflict(
        `Ticket must be in 'called' status to start serving (was '${entry.status}')`
      );
    }

    return queueEntriesRepository.markServing(entryId);
  },

  /**
   * Mark a called ticket as no-show (staff action).
   * Transitions called → no_show. The customer did not appear at the counter.
   */
  async noShowTicket(params: { entryId: string; actorUserId?: string }): Promise<QueueEntryRow> {
    const { entryId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    if (entry.status !== 'called') {
      throw AppError.conflict(
        `Ticket must be in 'called' status to mark as no-show (was '${entry.status}')`
      );
    }

    const noShown = await queueEntriesRepository.markNoShow(entryId);

    // Record no-show penalty (fire-and-forget).
    if (entry.user_id) {
      const queue = await queuesRepository.findById(entry.queue_id);
      if (queue) {
        void skipPenaltyService
          .onNoShow({
            userId: entry.user_id,
            queueId: entry.queue_id,
            entryId: entry.id,
            organizationId: queue.organization_id,
          })
          .catch((err: unknown) => logger.warn({ err }, 'skip-penalty: onNoShow failed'));
      }
    }

    return noShown;
  },

  /**
   * Mark a serving ticket as completed.
   * Writes a queue_histories row via archiveToHistory (called inside markCompleted transaction).
   */
  async completeTicket(params: { entryId: string; actorUserId?: string }): Promise<QueueEntryRow> {
    const { entryId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    if (entry.status !== 'serving') {
      throw AppError.conflict(
        `Ticket must be in 'serving' status to complete (was '${entry.status}')`
      );
    }

    const completed = await queueEntriesRepository.markCompleted(entryId);
    // Free the anti-duplicate registry for this entry — it has reached
    // a terminal state and will never trigger further notifications.
    return completed;
  },
};

// Auxiliary re-exports so tests can import DTO types via this module
export type {
  CurrentQueueQuery,
  EntryIdParam,
  JoinQueueDto,
  QueueIdParam,
} from './queue.validator';
