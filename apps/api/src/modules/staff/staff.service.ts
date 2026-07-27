import { auditLogRepository } from '../../db/repositories/audit-log.repository';
import { ordersRepository, OrderWithItems } from '../../db/repositories/orders.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';
import { branchesRepository } from '../branches/branches.repository';
import { inventoryService } from '../inventory/inventory.service';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';
import { queueNotificationService } from '../notifications/queue-notification.service';
import { paymentsService } from '../payments/payments.service';
import { queueService } from '../queue/queue.service';
import { tryAutoCallNextWaiting } from '../queue/queue-auto-call.service';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QueueOverview {
  queueId: string;
  queueName: string;
  waitingEntries: QueueEntryRow[];
  calledEntry: QueueEntryRow | null;
  servingEntry: QueueEntryRow | null;
  waitingCount: number;
  totalActiveCount: number;
}

export interface EntryWithOrder extends QueueEntryRow {
  order: OrderWithItems | null;
}

export interface EnrichedQueueOverview {
  queueId: string;
  queueName: string;
  availableQueues: Array<{ id: string; name: string }>;
  orgId: string;
  waitingEntriesWithOrders: EntryWithOrder[];
  calledEntryWithOrder: EntryWithOrder | null;
  servingEntryWithOrder: EntryWithOrder | null;
  waitingCount: number;
  totalActiveCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STAFF_QUEUE_PREVIEW_LIMIT = 8;

function assertBranchAccess(branchId: string | undefined, actorBranchIds: string[]): void {
  if (!branchId || !actorBranchIds.includes(branchId)) {
    throw AppError.forbidden('Queue is outside your assigned branches');
  }
}

async function assertQueueAccess(
  queueId: string,
  actorOrganizationId?: string,
  actorBranchIds: string[] = []
) {
  const queue = await queuesRepository.findById(queueId);
  if (!queue) throw AppError.notFound('Queue');
  if (actorOrganizationId && queue.organization_id !== actorOrganizationId) {
    throw AppError.forbidden('Queue is outside your organization');
  }
  assertBranchAccess(queue.branch_id, actorBranchIds);
  return queue;
}

async function assertEntryAccess(
  entryId: string,
  actorOrganizationId?: string,
  actorBranchIds: string[] = []
) {
  const entry = await queueEntriesRepository.findById(entryId);
  if (!entry) throw AppError.notFound('Ticket');
  const queue = await assertQueueAccess(entry.queue_id, actorOrganizationId, actorBranchIds);
  return { entry, queue };
}

/**
 * Record a staff action in the audit log.
 * Fire-and-forget: a logging failure must never roll back the queue operation.
 */
function auditStaff(
  actorUserId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes?: Record<string, unknown>
): void {
  void auditLogRepository
    .create({
      actorId: actorUserId,
      actorType: 'user',
      action,
      resourceType,
      resourceId,
      changes,
    })
    .catch((err: unknown) => {
      logger.error({ err, action, resourceId }, 'staff.audit.error');
    });
}

// ── Service ────────────────────────────────────────────────────────────────────

export const staffService = {
  async getMyBranch(organizationId: string, branchId: string) {
    const branch = await branchesRepository.findById(branchId, organizationId);
    if (!branch) throw AppError.notFound('Assigned branch');
    const queues = await queuesRepository.findActiveByBranches(organizationId, [branchId]);
    return { ...branch, queues };
  },

  /**
   * Get a live overview of a queue for the staff board.
   * Returns waiting list, currently called entry, and currently serving entry.
   */
  async getQueueOverview(
    queueId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueOverview> {
    const queue = await assertQueueAccess(queueId, actorOrganizationId, actorBranchIds);

    const [waitingCount, totalActiveCount, calledEntry, servingEntry] = await Promise.all([
      queueEntriesRepository.countWaiting(queueId),
      queuesRepository.countWaiting(queueId),
      queueEntriesRepository.findByQueueAndStatus(queueId, 'called'),
      queueEntriesRepository.findByQueueAndStatus(queueId, 'serving'),
    ]);
    const occupiedPreviewSlots = Number(Boolean(calledEntry)) + Number(Boolean(servingEntry));
    const waiting = await queueEntriesRepository.listWaiting(
      queueId,
      undefined,
      STAFF_QUEUE_PREVIEW_LIMIT - occupiedPreviewSlots
    );

    return {
      queueId,
      queueName: queue.name,
      waitingEntries: waiting,
      calledEntry: calledEntry ?? null,
      servingEntry: servingEntry ?? null,
      waitingCount,
      totalActiveCount,
    };
  },

  /** Call the next waiting ticket. Records audit log entry. */
  async callNext(
    queueId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    await assertQueueAccess(queueId, actorOrganizationId, actorBranchIds);
    const entry = await queueService.callNextTicket(
      queueId,
      undefined,
      undefined,
      actorOrganizationId,
      actorBranchIds[0]
    );
    auditStaff(actorUserId, 'call_next', 'queue_entry', entry.id, {
      queueId,
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /** Mark a called ticket as serving. Records audit log entry. */
  async serve(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    await assertEntryAccess(entryId, actorOrganizationId, actorBranchIds);
    const entry = await queueService.serveTicket({
      entryId,
      actorUserId,
      actorOrganizationId,
      actorBranchId: actorBranchIds[0],
    });
    auditStaff(actorUserId, 'serve', 'queue_entry', entry.id, {
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /** Mark a serving ticket as completed. Records audit log entry. */
  async complete(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    await assertEntryAccess(entryId, actorOrganizationId, actorBranchIds);
    const entry = await queueService.completeTicket({
      entryId,
      actorUserId,
      actorOrganizationId,
      actorBranchId: actorBranchIds[0],
    });
    auditStaff(actorUserId, 'complete', 'queue_entry', entry.id, {
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /** Move a called customer behind current waiting customers and advance the queue. */
  async deferCalled(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    await assertEntryAccess(entryId, actorOrganizationId, actorBranchIds);
    const entry = await queueService.deferCalledTicket({
      entryId,
      actorUserId,
      actorOrganizationId,
    });
    auditStaff(actorUserId, 'defer_called', 'queue_entry', entry.id, {
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /**
   * Mark a called ticket as no-show (customer did not appear).
   * Records audit log entry.
   */
  async markNoShow(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    await assertEntryAccess(entryId, actorOrganizationId, actorBranchIds);
    const entry = await queueService.noShowTicket({ entryId, actorUserId, actorOrganizationId });
    auditStaff(actorUserId, 'no_show', 'queue_entry', entry.id, {
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /**
   * Cancel an entry as a staff action. Works on waiting or called entries.
   * Records audit log entry.
   */
  async cancelEntry(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string,
    actorBranchIds: string[] = []
  ): Promise<QueueEntryRow> {
    const { entry, queue } = await assertEntryAccess(entryId, actorOrganizationId, actorBranchIds);

    if (!['waiting', 'called'].includes(entry.status)) {
      throw AppError.conflict(
        `Ticket must be in 'waiting' or 'called' status to cancel (was '${entry.status}')`
      );
    }

    const cancelled = await withTransaction(async (client) => {
      const lockedQueue = await queuesRepository.lockById(queue.id, client);
      if (!lockedQueue) throw AppError.notFound('Queue');
      const updated = await queueEntriesRepository.markCancelled(entryId, client);
      if (updated.order_id) {
        await paymentsService.refundOrderOnCancellationInClient({
          orderId: updated.order_id,
          organizationId: queue.organization_id,
          actorId: actorUserId,
          reason: 'Queue ticket cancelled by staff',
          client,
        });
        await inventoryService.releaseOrder(
          updated.order_id,
          client,
          'staff_cancelled',
          actorUserId
        );
        await client.query(
          `UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status IN ('pending','processing')`,
          [updated.order_id]
        );
      }
      await queueNotificationService.notifyTicketCancelled(
        updated,
        { organizationId: queue.organization_id },
        notificationOutboxRepository,
        client
      );
      await tryAutoCallNextWaiting(lockedQueue, client);
      return updated;
    });
    metricsService.increment('queue_cancelled_total');
    auditStaff(actorUserId, 'staff_cancel', 'queue_entry', cancelled.id, {
      ticket: cancelled.ticket_code,
      previousStatus: entry.status,
    });
    return cancelled;
  },

  /**
   * Get the org's active queue enriched with orders for each entry.
   * Used by the staff dashboard to show the full picture in one request.
   */
  async getMyQueueOverview(
    organizationId: string,
    branchIds: string[] = [],
    requestedQueueId?: string
  ): Promise<EnrichedQueueOverview | null> {
    const queues = await queuesRepository.findActiveByBranches(organizationId, branchIds);
    if (queues.length === 0) return null;
    const overviews = await Promise.all(
      queues.map(async (queue) => ({
        queue,
        overview: await this.getQueueOverview(queue.id, organizationId, branchIds),
      }))
    );
    const selected = requestedQueueId
      ? overviews.find(({ queue }) => queue.id === requestedQueueId)
      : (overviews.find(
          ({ overview }) =>
            overview.totalActiveCount > 0 ||
            overview.calledEntry !== null ||
            overview.servingEntry !== null
        ) ?? overviews[0]);
    if (!selected) throw AppError.forbidden('Queue is outside your assigned branch');
    const { queue, overview } = selected;

    const enrichEntry = async (entry: QueueEntryRow | null): Promise<EntryWithOrder | null> => {
      if (!entry) return null;
      const order = await ordersRepository.findByQueueEntry(entry.id);
      return { ...entry, order: order ?? null };
    };

    const [waitingWithOrders, calledWithOrder, servingWithOrder] = await Promise.all([
      Promise.all(overview.waitingEntries.map((e) => enrichEntry(e))),
      enrichEntry(overview.calledEntry),
      enrichEntry(overview.servingEntry),
    ]);

    return {
      queueId: queue.id,
      queueName: queue.name,
      availableQueues: queues.map((item) => ({ id: item.id, name: item.name })),
      orgId: organizationId,
      waitingEntriesWithOrders: waitingWithOrders.filter(Boolean) as EntryWithOrder[],
      calledEntryWithOrder: calledWithOrder,
      servingEntryWithOrder: servingWithOrder,
      waitingCount: overview.waitingCount,
      totalActiveCount: overview.totalActiveCount,
    };
  },
};
