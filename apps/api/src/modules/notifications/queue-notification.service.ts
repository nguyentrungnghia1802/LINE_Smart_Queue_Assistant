/**
 * Queue Notification Service
 *
 * Translates queue lifecycle events into durable LINE notification outbox rows.
 * This service does not call LINE. A background worker claims committed outbox
 * rows and delivers them through LineNotificationService after the business
 * transaction has committed.
 */

import type { PoolClient } from 'pg';

import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { logger } from '../../utils/logger';

import type { TicketNotificationEventType } from './line-notification.templates';
import {
  buildQueueNotificationEventKey,
  type NotificationOutboxRepository,
  notificationOutboxRepository,
} from './notification-outbox.repository';

/**
 * Send an ETA warning when this many entries are still ahead of the customer.
 * Threshold of 2 means "you are 3rd in line or closer".
 */
export const ETA_WARNING_THRESHOLD = 2;

interface TicketNotificationSnapshot {
  organizationId?: string;
  aheadCount?: number | null;
  estimatedWaitSeconds?: number | null;
}

async function resolveOrganizationId(
  entry: QueueEntryRow,
  snapshot: TicketNotificationSnapshot
): Promise<string | null> {
  if (snapshot.organizationId) return snapshot.organizationId;
  const queue = await queuesRepository.findById(entry.queue_id);
  return queue?.organization_id ?? null;
}

function buildPayload(entry: QueueEntryRow, snapshot: TicketNotificationSnapshot) {
  return {
    ticketCode: entry.ticket_code,
    aheadCount: snapshot.aheadCount ?? null,
    estimatedWaitSeconds: snapshot.estimatedWaitSeconds ?? entry.estimated_wait_seconds ?? null,
  };
}

async function enqueueTicketNotification(
  entry: QueueEntryRow,
  eventType: TicketNotificationEventType,
  snapshot: TicketNotificationSnapshot,
  repository: NotificationOutboxRepository,
  client?: PoolClient
): Promise<void> {
  if (!entry.line_user_id) return;

  const organizationId = await resolveOrganizationId(entry, snapshot);
  if (!organizationId) {
    logger.warn({ entryId: entry.id, eventType }, 'notification.enqueue.skipped_no_org');
    return;
  }

  const eventKey = buildQueueNotificationEventKey(entry.id, eventType);
  await repository.enqueue(
    {
      organizationId,
      queueEntryId: entry.id,
      userId: entry.user_id,
      lineUserId: entry.line_user_id,
      eventType,
      eventKey,
      payload: buildPayload(entry, snapshot),
    },
    client
  );
}

async function enqueueTerminalNotification(
  entry: QueueEntryRow,
  eventType: TicketNotificationEventType,
  snapshot: TicketNotificationSnapshot,
  repository: NotificationOutboxRepository,
  client?: PoolClient
): Promise<void> {
  const eventKey = buildQueueNotificationEventKey(entry.id, eventType);
  await repository.cancelPendingForEntry(entry.id, eventKey, client);
  await enqueueTicketNotification(entry, eventType, snapshot, repository, client);
}

export const queueNotificationService = {
  async notifyBookingCreated(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTicketNotification(entry, 'booking_created', snapshot, repository, client);
  },

  async notifyTicketCalled(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTicketNotification(
      entry,
      'called',
      { ...snapshot, aheadCount: snapshot.aheadCount ?? 0, estimatedWaitSeconds: 0 },
      repository,
      client
    );
  },

  async notifyEtaWarning(
    entry: QueueEntryRow,
    aheadCount: number,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    if (aheadCount > ETA_WARNING_THRESHOLD) return;
    await enqueueTicketNotification(
      entry,
      'eta_warning',
      { ...snapshot, aheadCount },
      repository,
      client
    );
  },

  async notifyTicketServing(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTicketNotification(
      entry,
      'serving',
      { ...snapshot, aheadCount: snapshot.aheadCount ?? 0, estimatedWaitSeconds: 0 },
      repository,
      client
    );
  },

  async notifyTicketCompleted(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTerminalNotification(
      entry,
      'completed',
      { ...snapshot, aheadCount: snapshot.aheadCount ?? 0, estimatedWaitSeconds: 0 },
      repository,
      client
    );
  },

  async notifyTicketNoShow(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTerminalNotification(
      entry,
      'no_show',
      { ...snapshot, aheadCount: snapshot.aheadCount ?? 0, estimatedWaitSeconds: 0 },
      repository,
      client
    );
  },

  async notifyTicketCancelled(
    entry: QueueEntryRow,
    snapshot: TicketNotificationSnapshot = {},
    repository: NotificationOutboxRepository = notificationOutboxRepository,
    client?: PoolClient
  ): Promise<void> {
    await enqueueTerminalNotification(
      entry,
      'cancelled',
      { ...snapshot, aheadCount: snapshot.aheadCount ?? 0, estimatedWaitSeconds: 0 },
      repository,
      client
    );
  },
};
