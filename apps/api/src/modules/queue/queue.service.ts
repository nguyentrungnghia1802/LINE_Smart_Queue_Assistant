import type { PoolClient } from 'pg';

import {
  batchWorkloadForEntries,
  calculateWorkloadForEntries,
  ordersRepository,
  OrderWithItems,
} from '../../db/repositories/orders.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';
import { etaService } from '../eta/eta.service';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';
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
function formatTicketCode(prefix: string, ticketNumber: number): string {
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

async function assertQueueBelongsToOrg(queueId: string, organizationId?: string) {
  if (!organizationId) throw AppError.forbidden('User has no organization');
  const queue = await queuesRepository.findById(queueId);
  if (!queue) throw AppError.notFound('Queue');
  if (queue.organization_id !== organizationId) {
    throw AppError.forbidden('Queue is outside your organization');
  }
  return queue;
}

async function assertEntryBelongsToOrg(entry: QueueEntryRow, organizationId?: string) {
  return assertQueueBelongsToOrg(entry.queue_id, organizationId);
}

async function getWaitingPositionInTransaction(
  client: PoolClient,
  entry: Pick<QueueEntryRow, 'queue_id' | 'priority' | 'ticket_number'>
): Promise<number> {
  const { rows } = await client.query<{ pos: string }>(
    `SELECT COUNT(*) AS pos
     FROM queue_entries
     WHERE queue_id = $1
       AND status = 'waiting'
       AND (priority > $2 OR (priority = $2 AND ticket_number < $3))`,
    [entry.queue_id, entry.priority, entry.ticket_number]
  );
  return Number(rows[0]?.pos ?? 0);
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
    const { queueId, userId, lineUserId } = dto;
    // Note: guestName/notes are stored in the linked order, not on the queue entry (new schema).

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

    // 6. Atomically increment counter + insert entry + outbox inside a transaction
    const created = await withTransaction(async (client) => {
      const ticketNumber = await queuesRepository.incrementAndGetCounter(queueId, client);
      const ticketCode = formatTicketCode(queue.prefix ?? '', ticketNumber);
      const entry = await queueEntriesRepository.create(
        {
          queueId,
          ticketNumber,
          ticketCode,
          userId,
          lineUserId,
          priority: priorityAdjustment === 0 ? undefined : priorityAdjustment,
        },
        client
      );

      const aheadCount = await getWaitingPositionInTransaction(client, entry);
      const estimatedWaitSeconds = etaService.calculate({
        aheadCount,
        avgServiceSeconds: queue.avg_service_seconds,
      }).estimatedWaitSeconds;
      await queueNotificationService.notifyBookingCreated(
        entry,
        {
          organizationId: queue.organization_id,
          aheadCount,
          estimatedWaitSeconds,
        },
        notificationOutboxRepository,
        client
      );
      return { entry, aheadCount, estimatedWaitSeconds };
    });

    return {
      entry: created.entry,
      aheadCount: created.aheadCount,
      estimatedWaitSeconds: created.estimatedWaitSeconds,
      isExisting: false,
    };
  },

  /**
   * Return all active tickets the caller holds across all queues,
   * each annotated with queue position and ETA.
   * Used on the "My Tickets" LIFF screen.
   *
   * Performance: uses batch queries to avoid N+1 pattern.
   *   - One findAllActiveForActor call
   *   - N parallel getWaitingPosition + findById + getEntryIdsAhead (already batched per entry)
   *   - ONE batchWorkloadForEntries call for all entry IDs at once
   */
  async getMyTickets(params: {
    userId?: string;
    lineUserId?: string;
  }): Promise<TicketPositionResult[]> {
    const { userId, lineUserId } = params;
    const entries = await queueEntriesRepository.findAllActiveForActor(userId, lineUserId);

    if (entries.length === 0) return [];

    // Step 1: fetch position + queue config for all entries in parallel
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const [aheadCount, queue, entryIdsAhead] = await Promise.all([
          queuesRepository.getWaitingPosition(entry.queue_id, entry.priority, entry.ticket_number),
          queuesRepository.findById(entry.queue_id),
          queueEntriesRepository.getEntryIdsAhead(
            entry.queue_id,
            entry.priority,
            entry.ticket_number
          ),
        ]);
        return { entry, aheadCount, queue, entryIdsAhead };
      })
    );

    // Step 2: batch workload calculation — single DB round-trip for all entries
    const allIdsAhead = enriched.flatMap((e) => e.entryIdsAhead);
    const workloadMap = await batchWorkloadForEntries(allIdsAhead);

    // Step 3: compute ETA using pre-fetched workload data
    return enriched.map(({ entry, aheadCount, queue, entryIdsAhead }) => {
      const totalWorkloadMinutes = entryIdsAhead.reduce(
        (sum, id) => sum + (workloadMap.get(id) ?? 0),
        0
      );
      return {
        entry,
        aheadCount,
        estimatedWaitSeconds: queue
          ? etaService.calculate({
              aheadCount,
              avgServiceSeconds: queue.avg_service_seconds,
              totalWorkloadMinutes,
            }).estimatedWaitSeconds
          : 0,
      };
    });
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

    const queue = await queuesRepository.findById(entry.queue_id);
    if (!queue) throw AppError.notFound('Queue');

    await withTransaction(async (client) => {
      const cancelled = await queueEntriesRepository.markCancelled(entryId, client);
      await queueNotificationService.notifyTicketCancelled(
        cancelled,
        { organizationId: queue.organization_id },
        notificationOutboxRepository,
        client
      );
    });
    metricsService.increment('queue_cancelled_total');
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
   * - `entry.priority < queue.max_skips_before_penalty`
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

    // Record a skip penalty when the customer reaches the skip limit.
    // Fire-and-forget — a penalty-write failure must not block the queue operation.
    if (entry.user_id) {
      // Check if skip count threshold reached (tracked via queue.max_skips_before_penalty)
      const updatedEntry = await queueEntriesRepository.findById(entryId);
      void skipPenaltyService
        .onSkipExhausted({
          userId: entry.user_id,
          queueId: entry.queue_id,
          entryId: entry.id,
          organizationId: queue.organization_id,
        })
        .catch((err: unknown) => logger.warn({ err }, 'skip-penalty: onSkipExhausted failed'));
      void updatedEntry;
    }

    const aheadCount = await queuesRepository.getWaitingPosition(
      entry.queue_id,
      updated.priority,
      updated.ticket_number
    );

    return { entry: updated, aheadCount, skipCount: 0 };
  },

  // ── Staff operations ─────────────────────────────────────────────────────────

  /**
   * Call the next waiting ticket in a queue.
   *
   * **State transition**: waiting → called (atomic UPDATE … WHERE status='waiting').
   * Concurrent calls are safe: the first UPDATE wins; subsequent callers for the
   * same entry get a 409 from markCalled's RETURNING guard.
   *
   * **Notifications** are enqueued in the same transaction as the state
   * transition. The delivery worker sends LINE messages after commit.
   *
   * @param adapter  Legacy test parameter, no longer used.
   * @param log      Legacy test parameter, no longer used.
   */
  async callNextTicket(
    queueId: string,
    _adapter?: unknown,
    _log?: unknown,
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
    const queue = await queuesRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');
    if (actorOrganizationId && queue.organization_id !== actorOrganizationId) {
      throw AppError.forbidden('Queue is outside your organization');
    }

    return withTransaction(async (client) => {
      const waiting = await queueEntriesRepository.listWaiting(queueId, client);
      if (waiting.length === 0) {
        throw AppError.conflict('No waiting entries in this queue');
      }

      const [next, nextUp] = waiting;

      // Atomic status transition — throws if entry was concurrently moved.
      const called = await queueEntriesRepository.markCalled(next.id, client);

      await queueNotificationService.notifyTicketCalled(
        { ...called, estimated_wait_seconds: 0 },
        {
          organizationId: queue.organization_id,
          aheadCount: 0,
          estimatedWaitSeconds: 0,
        },
        notificationOutboxRepository,
        client
      );

      // Warn the entry now at position 1 (was position 2 before calling `next`).
      if (nextUp) {
        await queueNotificationService.notifyEtaWarning(
          nextUp,
          1,
          { organizationId: queue.organization_id },
          notificationOutboxRepository,
          client
        );
      }

      return called;
    });
  },

  /**
   * Mark a called ticket as serving (customer has reached the counter).
   * Requires the entry to be in `called` status.
   */
  async serveTicket(params: {
    entryId: string;
    actorUserId?: string;
    actorOrganizationId?: string;
  }): Promise<QueueEntryRow> {
    const { entryId, actorOrganizationId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');
    const queue = await assertEntryBelongsToOrg(entry, actorOrganizationId);

    if (entry.status !== 'called') {
      throw AppError.conflict(
        `Ticket must be in 'called' status to start serving (was '${entry.status}')`
      );
    }

    return withTransaction(async (client) => {
      const serving = await queueEntriesRepository.markServing(entryId, client);
      await queueNotificationService.notifyTicketServing(
        serving,
        { organizationId: queue.organization_id },
        notificationOutboxRepository,
        client
      );
      return serving;
    });
  },

  /**
   * Mark a serving ticket as served (was 'completed' in old schema).
   * Archives to queue_histories.
   */
  async completeTicket(params: {
    entryId: string;
    actorUserId?: string;
    actorOrganizationId?: string;
  }): Promise<QueueEntryRow> {
    const { entryId, actorOrganizationId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');
    const queue = await assertEntryBelongsToOrg(entry, actorOrganizationId);

    if (entry.status !== 'serving') {
      throw AppError.conflict(
        `Ticket must be in 'serving' status to complete (was '${entry.status}')`
      );
    }

    const served = await withTransaction(async (client) => {
      const updated = await queueEntriesRepository.markServed(entryId, client);
      await queueNotificationService.notifyTicketCompleted(
        updated,
        { organizationId: queue.organization_id },
        notificationOutboxRepository,
        client
      );
      await queueEntriesRepository.archiveToHistory(
        updated,
        'serving',
        'served',
        undefined,
        client
      );
      return updated;
    });
    metricsService.increment('queue_served_total');
    return served;
  },

  /**
   * Mark a called ticket as no-show (customer did not appear).
   * Staff action — requires entry to be in `called` status.
   */
  async noShowTicket(params: {
    entryId: string;
    actorUserId?: string;
    actorOrganizationId?: string;
  }): Promise<QueueEntryRow> {
    const { entryId, actorOrganizationId } = params;

    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');
    const queue = await assertEntryBelongsToOrg(entry, actorOrganizationId);

    if (entry.status !== 'called') {
      throw AppError.conflict(
        `Ticket must be in 'called' status to mark as no-show (was '${entry.status}')`
      );
    }

    return withTransaction(async (client) => {
      const noShow = await queueEntriesRepository.markNoShow(entryId, client);
      await queueNotificationService.notifyTicketNoShow(
        noShow,
        { organizationId: queue.organization_id },
        notificationOutboxRepository,
        client
      );
      await queueEntriesRepository.archiveToHistory(noShow, 'called', 'no_show', undefined, client);
      return noShow;
    });
  },

  /** Public ticket status — no auth required. Used by the guest ticket-tracking page. */
  async getTicketStatus(entryId: string): Promise<{
    entry: QueueEntryRow;
    order: OrderWithItems | null;
    aheadCount: number;
    estimatedWaitSeconds: number | null;
    queueName: string;
  }> {
    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');

    const queue = await queuesRepository.findById(entry.queue_id);
    if (!queue) throw AppError.notFound('Queue');

    const aheadCount = ['waiting', 'called'].includes(entry.status)
      ? await queuesRepository.getWaitingPosition(
          entry.queue_id,
          entry.priority,
          entry.ticket_number
        )
      : 0;

    // Workload-aware ETA: sum service_time_minutes × qty for entries ahead
    const entryIdsAhead =
      aheadCount > 0
        ? await queueEntriesRepository.getEntryIdsAhead(
            entry.queue_id,
            entry.priority,
            entry.ticket_number
          )
        : [];
    const totalWorkloadMinutes =
      entryIdsAhead.length > 0 ? await calculateWorkloadForEntries(entryIdsAhead) : 0;

    // Fetch linked order for customer display
    const order = await ordersRepository.findByQueueEntry(entryId);

    return {
      entry,
      order: order ?? null,
      aheadCount,
      estimatedWaitSeconds: etaService.calculate({
        aheadCount,
        avgServiceSeconds: queue.avg_service_seconds,
        totalWorkloadMinutes,
      }).estimatedWaitSeconds,
      queueName: queue.name,
    };
  },
};

// Auxiliary re-exports so tests can import DTO types via this module
export type {
  CurrentQueueQuery,
  EntryIdParam,
  JoinQueueDto,
  QueueIdParam,
} from './queue.validator';
