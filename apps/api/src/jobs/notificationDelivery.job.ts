import { config } from '../config';
import type { ILineMessagingAdapter } from '../modules/line/line.adapter';
import { lineMessagingAdapter } from '../modules/line/line.messaging';
import { lineNotificationService } from '../modules/notifications/line-notification.service';
import {
  buildTicketDeepLink,
  buildTicketNotification,
  type TicketNotificationEventType,
} from '../modules/notifications/line-notification.templates';
import {
  type NotificationOutboxRepository,
  notificationOutboxRepository,
  type NotificationOutboxRow,
} from '../modules/notifications/notification-outbox.repository';
import { logger } from '../utils/logger';
import { metricsService } from '../utils/metrics';

export interface NotificationDeliveryOptions {
  repository?: NotificationOutboxRepository;
  adapter?: ILineMessagingAdapter;
  batchSize?: number;
  now?: () => Date;
}

const EVENT_TYPES = new Set<TicketNotificationEventType>([
  'booking_created',
  'eta_warning',
  'called',
  'serving',
  'completed',
  'cancelled',
  'no_show',
  'location_warning',
]);

function asEventType(value: string): TicketNotificationEventType {
  if (EVENT_TYPES.has(value as TicketNotificationEventType)) {
    return value as TicketNotificationEventType;
  }
  throw new Error(`Unsupported notification event type: ${value}`);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function buildTemplateFromOutbox(row: NotificationOutboxRow) {
  if (!row.queue_entry_id) throw new Error('Notification is missing queue_entry_id');
  const payload = row.payload ?? {};
  return buildTicketNotification({
    eventType: asEventType(row.event_type),
    ticketCode: stringOrFallback(payload.ticketCode, '----'),
    ticketUrl: buildTicketDeepLink(row.queue_entry_id, {
      liffId: config.line.liffId,
      webOrigin: config.web.origin,
    }),
    aheadCount: numberOrNull(payload.aheadCount),
    estimatedWaitSeconds: numberOrNull(payload.estimatedWaitSeconds),
    locale: row.locale,
  });
}

export function calculateNextRetryAt(
  attemptCount: number,
  now: Date,
  baseSeconds = config.notifications.retryBaseSeconds
): Date {
  const delaySeconds = baseSeconds * 2 ** Math.max(0, attemptCount - 1);
  return new Date(now.getTime() + delaySeconds * 1000);
}

async function handleDeliveryFailure(
  row: NotificationOutboxRow,
  error: unknown,
  repository: NotificationOutboxRepository,
  now: Date
): Promise<void> {
  if (row.attempt_count >= row.max_attempts) {
    await repository.markFailed(row.id, error);
    metricsService.increment('notifications_outbox_failed_total');
    return;
  }

  await repository.markRetry(row.id, calculateNextRetryAt(row.attempt_count, now), error);
  metricsService.increment('notifications_outbox_retry_scheduled_total');
}

export async function deliverOutboxNotification(
  row: NotificationOutboxRow,
  options: Required<Pick<NotificationDeliveryOptions, 'repository' | 'adapter' | 'now'>>
): Promise<void> {
  const { repository, adapter, now } = options;
  if (!row.line_user_id) {
    await repository.markFailed(row.id, 'Missing LINE user ID');
    return;
  }

  if (repository.canDeliver && !(await repository.canDeliver(row))) {
    await repository.cancel(row.id, 'Notification preference disabled');
    return;
  }

  try {
    const sent = await lineNotificationService.pushTicketNotification(
      row.line_user_id,
      buildTemplateFromOutbox(row),
      { entryId: row.queue_entry_id ?? undefined, eventType: row.event_type },
      adapter
    );

    if (sent) {
      await repository.markSent(row.id);
      metricsService.increment('notifications_outbox_sent_total');
      return;
    }

    await handleDeliveryFailure(row, 'LINE notification delivery failed', repository, now());
  } catch (err) {
    await handleDeliveryFailure(row, err, repository, now());
  }
}

export async function runNotificationDelivery(
  options: NotificationDeliveryOptions = {}
): Promise<void> {
  const repository = options.repository ?? notificationOutboxRepository;
  const adapter = options.adapter ?? lineMessagingAdapter;
  const batchSize = options.batchSize ?? config.notifications.deliveryBatchSize;
  const now = options.now ?? (() => new Date());

  const batch = await repository.claimDue(batchSize);
  if (batch.length > 0)
    logger.debug({ count: batch.length }, 'notificationDelivery: claimed batch');

  for (const row of batch) {
    try {
      await deliverOutboxNotification(row, { repository, adapter, now });
    } catch (err) {
      logger.error({ err, notificationId: row.id }, 'notificationDelivery: unexpected row error');
    }
  }

  if (repository.deliveryMetrics) {
    const values = await repository.deliveryMetrics();
    metricsService.setGauge('notifications_outbox_backlog', Number(values.pending));
    metricsService.setGauge('notifications_outbox_retry_backlog', Number(values.retrying));
    metricsService.setGauge('notifications_outbox_failed', Number(values.failed));
    metricsService.setGauge(
      'notifications_delivery_latency_seconds',
      Number(values.latency_seconds)
    );
  }
}
