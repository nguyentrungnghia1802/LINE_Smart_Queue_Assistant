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
import { inventoryService } from '../inventory/inventory.service';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';
import { queueNotificationService } from '../notifications/queue-notification.service';
import { queueService } from '../queue/queue.service';

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
  orgId: string;
  waitingEntriesWithOrders: EntryWithOrder[];
  calledEntryWithOrder: EntryWithOrder | null;
  servingEntryWithOrder: EntryWithOrder | null;
  waitingCount: number;
  totalActiveCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STAFF_QUEUE_PREVIEW_LIMIT = 8;

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
      actorType: 'staff',
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
  /**
   * Get a live overview of a queue for the staff board.
   * Returns waiting list, currently called entry, and currently serving entry.
   */
  async getQueueOverview(queueId: string, actorOrganizationId?: string): Promise<QueueOverview> {
    const queue = await queuesRepository.findById(queueId);
    if (!queue) throw AppError.notFound('Queue');
    if (actorOrganizationId && queue.organization_id !== actorOrganizationId) {
      throw AppError.forbidden('Queue is outside your organization');
    }

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
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
    const entry = await queueService.callNextTicket(
      queueId,
      undefined,
      undefined,
      actorOrganizationId
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
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
    const entry = await queueService.serveTicket({ entryId, actorUserId, actorOrganizationId });
    auditStaff(actorUserId, 'serve', 'queue_entry', entry.id, {
      ticket: entry.ticket_code,
    });
    return entry;
  },

  /** Mark a serving ticket as completed. Records audit log entry. */
  async complete(
    entryId: string,
    actorUserId: string,
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
    const entry = await queueService.completeTicket({ entryId, actorUserId, actorOrganizationId });
    auditStaff(actorUserId, 'complete', 'queue_entry', entry.id, {
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
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
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
    actorOrganizationId?: string
  ): Promise<QueueEntryRow> {
    // Staff cancel — load entry first to confirm it exists, then cancel
    const entry = await queueEntriesRepository.findById(entryId);
    if (!entry) throw AppError.notFound('Ticket');
    const queue = await queuesRepository.findById(entry.queue_id);
    if (!queue) throw AppError.notFound('Queue');
    if (actorOrganizationId && queue.organization_id !== actorOrganizationId) {
      throw AppError.forbidden('Ticket is outside your organization');
    }

    if (!['waiting', 'called'].includes(entry.status)) {
      throw AppError.conflict(
        `Ticket must be in 'waiting' or 'called' status to cancel (was '${entry.status}')`
      );
    }

    const cancelled = await withTransaction(async (client) => {
      const updated = await queueEntriesRepository.markCancelled(entryId, client);
      if (updated.order_id) {
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
  async getMyQueueOverview(organizationId: string): Promise<EnrichedQueueOverview | null> {
    const queues = await queuesRepository.findActiveByOrg(organizationId);
    if (queues.length === 0) return null;
    const overviews = await Promise.all(
      queues.map(async (queue) => ({
        queue,
        overview: await this.getQueueOverview(queue.id, organizationId),
      }))
    );
    const selected =
      overviews.find(
        ({ overview }) =>
          overview.totalActiveCount > 0 ||
          overview.calledEntry !== null ||
          overview.servingEntry !== null
      ) ?? overviews[0];
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
      orgId: organizationId,
      waitingEntriesWithOrders: waitingWithOrders.filter(Boolean) as EntryWithOrder[],
      calledEntryWithOrder: calledWithOrder,
      servingEntryWithOrder: servingWithOrder,
      waitingCount: overview.waitingCount,
      totalActiveCount: overview.totalActiveCount,
    };
  },
};
