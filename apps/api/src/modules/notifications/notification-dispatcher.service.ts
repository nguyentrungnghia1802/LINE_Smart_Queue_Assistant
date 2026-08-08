import { config } from '../../config';
import {
  buildLineNotificationJobId,
  LINE_NOTIFICATION_DELIVERY_JOB_NAME,
  LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
} from '../../infrastructure/bullmq/line-notification.contract';
import { injectTraceContext, type TraceCarrier, withSpan } from '../../observability/tracing';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import {
  type NotificationOutboxRepository,
  notificationOutboxRepository,
  type NotificationOutboxRow,
} from './notification-outbox.repository';

export interface NotificationDispatchQueue {
  add(
    name: typeof LINE_NOTIFICATION_DELIVERY_JOB_NAME,
    data: { version: 1; notificationId: string; traceContext?: TraceCarrier },
    options: {
      jobId: string;
      attempts: number;
      backoff: { type: 'line-provider'; delay: number };
      removeOnComplete: number;
      removeOnFail: number;
    }
  ): Promise<unknown>;
}

export interface NotificationDispatcherOptions {
  repository?: NotificationOutboxRepository;
  batchSize?: number;
  now?: () => Date;
  random?: () => number;
}

export function calculateDispatchRetryAt(
  attemptCount: number,
  now: Date,
  random = Math.random
): Date {
  const baseMs = config.notifications.retryBaseSeconds * 1_000;
  const cappedMs = Math.min(baseMs * 2 ** Math.max(0, attemptCount - 1), 5 * 60_000);
  const jitteredMs = cappedMs * (0.5 + Math.max(0, Math.min(1, random())) * 0.5);
  return new Date(now.getTime() + Math.round(jitteredMs));
}

async function dispatchRow(
  row: NotificationOutboxRow,
  queue: NotificationDispatchQueue,
  repository: NotificationOutboxRepository,
  now: () => Date,
  random: () => number
): Promise<void> {
  const jobId = row.dispatch_job_id ?? buildLineNotificationJobId(row.id);
  try {
    await withSpan(
      'notification.dispatch',
      async () => {
        const traceContext = injectTraceContext();
        await queue.add(
          LINE_NOTIFICATION_DELIVERY_JOB_NAME,
          {
            version: LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
            notificationId: row.id,
            ...(traceContext ? { traceContext } : {}),
          },
          {
            jobId,
            attempts: row.max_attempts,
            backoff: {
              type: 'line-provider',
              delay: config.notifications.retryBaseSeconds * 1_000,
            },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          }
        );
      },
      {
        attributes: {
          'messaging.system': 'bullmq',
          'messaging.destination.name': 'line-notifications',
        },
      }
    );
    await repository.markDispatched(row.id, jobId);
    metricsService.increment('notifications_dispatched_total');
  } catch (error) {
    await repository.markDispatchRetry(
      row.id,
      calculateDispatchRetryAt(row.dispatch_attempt_count, now(), random),
      error
    );
    metricsService.increment('notifications_dispatch_failed_total');
    logger.warn(
      { notificationId: row.id, dispatchAttempt: row.dispatch_attempt_count },
      'LINE notification dispatch deferred'
    );
  }
}

export async function dispatchNotificationOutbox(
  queue: NotificationDispatchQueue,
  options: NotificationDispatcherOptions = {}
): Promise<void> {
  const repository = options.repository ?? notificationOutboxRepository;
  const rows = await repository.claimForDispatch(
    options.batchSize ?? config.notifications.deliveryBatchSize
  );
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;

  for (const row of rows) {
    await dispatchRow(row, queue, repository, now, random);
  }

  const values = await repository.dispatchMetrics();
  metricsService.setGauge('notifications_undispatched', Number(values.undispatched));
  metricsService.setGauge(
    'notifications_oldest_undispatched_seconds',
    Number(values.oldest_seconds)
  );
}
