import { UnrecoverableError } from 'bullmq';

import { config } from '../config';
import type { ILineMessagingAdapter } from '../modules/line/line.adapter';
import { lineMessagingAdapter } from '../modules/line/line.messaging';
import { LineProviderError } from '../modules/line/line.sdk.adapter';
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
  random?: () => number;
}

export interface NotificationFailureClassification {
  retryable: boolean;
  retryAfterMs: number | null;
}

class NotificationPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationPayloadError';
  }
}

const EVENT_TYPES = new Set<TicketNotificationEventType>([
  'booking_created',
  'eta_warning',
  'called',
  'serving',
  'completed',
  'cancelled',
  'no_show',
  'deferred',
  'location_warning',
]);

function asEventType(value: string): TicketNotificationEventType {
  if (EVENT_TYPES.has(value as TicketNotificationEventType)) {
    return value as TicketNotificationEventType;
  }
  throw new NotificationPayloadError(`Unsupported notification event type: ${value}`);
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
  if (!row.queue_entry_id)
    throw new NotificationPayloadError('Notification is missing queue_entry_id');
  const payload = row.payload ?? {};
  return buildTicketNotification({
    eventType: asEventType(row.event_type),
    ticketCode: stringOrFallback(payload.ticketCode, '----'),
    ticketUrl: buildTicketDeepLink(row.queue_entry_id, {
      liffId: config.line.loginLiffId,
      liffEndpointPath: config.line.liffEndpointPath,
      webOrigin: config.web.origin,
    }),
    aheadCount: numberOrNull(payload.aheadCount),
    estimatedWaitSeconds: numberOrNull(payload.estimatedWaitSeconds),
    locale: row.locale,
  });
}

export function classifyLineDeliveryError(error: unknown): NotificationFailureClassification {
  if (error instanceof NotificationPayloadError) return { retryable: false, retryAfterMs: null };
  if (error instanceof LineProviderError) {
    return { retryable: error.retryable, retryAfterMs: error.retryAfterMs };
  }
  return { retryable: true, retryAfterMs: null };
}

export function calculateNextRetryAt(
  attemptCount: number,
  now: Date,
  baseSeconds = config.notifications.retryBaseSeconds,
  retryAfterMs = 0,
  random = Math.random
): Date {
  const exponentialMs = Math.min(
    baseSeconds * 1_000 * 2 ** Math.max(0, attemptCount - 1),
    60 * 60_000
  );
  const jitter = 0.5 + Math.max(0, Math.min(1, random())) * 0.5;
  return new Date(now.getTime() + Math.max(retryAfterMs, Math.round(exponentialMs * jitter)));
}

async function deliverClaimedNotification(
  row: NotificationOutboxRow,
  options: Required<Pick<NotificationDeliveryOptions, 'repository' | 'adapter' | 'now' | 'random'>>,
  throwRetryable: boolean
): Promise<void> {
  const { repository, adapter, now, random } = options;
  if (!row.line_user_id) {
    await repository.markFailed(row.id, 'Missing LINE user ID');
    if (throwRetryable) throw new UnrecoverableError('Missing LINE user ID');
    return;
  }

  if (repository.canDeliver && !(await repository.canDeliver(row))) {
    await repository.cancel(row.id, 'Notification preference disabled');
    return;
  }

  const startedAt = Date.now();
  try {
    await lineNotificationService.pushTicketNotificationOrThrow(
      row.line_user_id,
      buildTemplateFromOutbox(row),
      {
        entryId: row.queue_entry_id ?? undefined,
        eventType: row.event_type,
        retryKey: row.id,
      },
      adapter
    );
    await repository.markSent(row.id);
    metricsService.increment('notifications_outbox_sent_total');
  } catch (error) {
    const classification = classifyLineDeliveryError(error);
    const exhausted = row.attempt_count >= row.max_attempts;
    if (!classification.retryable || exhausted) {
      await repository.markFailed(row.id, error);
      metricsService.increment('notifications_outbox_failed_total');
      if (throwRetryable) throw new UnrecoverableError('LINE notification delivery exhausted');
      return;
    }

    await repository.markRetry(
      row.id,
      calculateNextRetryAt(
        row.attempt_count,
        now(),
        config.notifications.retryBaseSeconds,
        classification.retryAfterMs ?? 0,
        random
      ),
      error
    );
    metricsService.increment('notifications_outbox_retry_scheduled_total');
    if (throwRetryable) throw error;
  } finally {
    metricsService.setGauge(
      'notification_worker_processing_seconds',
      (Date.now() - startedAt) / 1_000
    );
  }
}

export async function processOutboxNotificationJob(
  notificationId: string,
  jobId: string,
  options: NotificationDeliveryOptions = {}
): Promise<void> {
  const repository = options.repository ?? notificationOutboxRepository;
  const row = await repository.claimForDelivery(notificationId, jobId);
  if (!row) return;

  try {
    await deliverClaimedNotification(
      row,
      {
        repository,
        adapter: options.adapter ?? lineMessagingAdapter,
        now: options.now ?? (() => new Date()),
        random: options.random ?? Math.random,
      },
      true
    );
  } finally {
    metricsService.setGauge('notification_worker_heartbeat_unixtime', Date.now() / 1_000);
  }
}

export async function deliverOutboxNotification(
  row: NotificationOutboxRow,
  options: Required<Pick<NotificationDeliveryOptions, 'repository' | 'adapter' | 'now'>> & {
    random?: () => number;
  }
): Promise<void> {
  await deliverClaimedNotification(
    row,
    { ...options, random: options.random ?? Math.random },
    false
  );
}

/** Native-development compatibility path. Production delivery uses per-row BullMQ jobs. */
export async function runNotificationDelivery(
  options: NotificationDeliveryOptions = {}
): Promise<void> {
  const repository = options.repository ?? notificationOutboxRepository;
  const adapter = options.adapter ?? lineMessagingAdapter;
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const batch = await repository.claimDue(
    options.batchSize ?? config.notifications.deliveryBatchSize
  );

  for (const row of batch) {
    try {
      await deliverOutboxNotification(row, { repository, adapter, now, random });
    } catch (error) {
      logger.error({ error, notificationId: row.id }, 'notificationDelivery: unexpected row error');
    }
  }

  const values = await repository.deliveryMetrics();
  metricsService.setGauge('notifications_outbox_backlog', Number(values.pending));
  metricsService.setGauge('notifications_outbox_retry_backlog', Number(values.retrying));
  metricsService.setGauge('notifications_outbox_failed', Number(values.failed));
  metricsService.setGauge(
    'notifications_oldest_pending_seconds',
    Number(values.oldest_pending_seconds)
  );
  metricsService.setGauge('notifications_delivery_latency_seconds', Number(values.latency_seconds));
  metricsService.setGauge('notification_worker_heartbeat_unixtime', Date.now() / 1_000);
}
