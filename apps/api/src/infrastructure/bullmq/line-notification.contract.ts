import { z } from 'zod';

import { config } from '../../config';

export const LINE_NOTIFICATION_QUEUE_NAME = 'line-notifications';
export const LINE_NOTIFICATION_DISPATCH_JOB_NAME = 'line.notification-outbox.dispatch.v1';
export const LINE_NOTIFICATION_DELIVERY_JOB_NAME = 'line.notification-delivery.v1';
export const LINE_NOTIFICATION_SCHEDULER_ID = 'line-notification-delivery-sweep-v1';
export const LINE_NOTIFICATION_JOB_CONTRACT_VERSION = 1 as const;

const traceContextSchema = z.record(z.string(), z.string()).optional();

export const lineNotificationDispatchJobSchema = z
  .object({
    version: z.literal(LINE_NOTIFICATION_JOB_CONTRACT_VERSION),
    traceContext: traceContextSchema,
  })
  .strict();

export const lineNotificationDeliveryJobSchema = z
  .object({
    version: z.literal(LINE_NOTIFICATION_JOB_CONTRACT_VERSION),
    notificationId: z.uuid(),
    traceContext: traceContextSchema,
  })
  .strict();

export type LineNotificationDispatchJobData = z.infer<typeof lineNotificationDispatchJobSchema>;
export type LineNotificationDeliveryJobData = z.infer<typeof lineNotificationDeliveryJobSchema>;
export type LineNotificationJobData =
  LineNotificationDispatchJobData | LineNotificationDeliveryJobData;

export function buildLineNotificationJobId(notificationId: string): string {
  return `line-notification-${notificationId}`;
}

export const LINE_NOTIFICATION_DISPATCH_JOB_POLICY = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

export const LINE_NOTIFICATION_WORKER_POLICY = {
  timeoutMs: config.bullmq.jobTimeoutMs,
  concurrency: config.bullmq.workerConcurrency,
  providerThrottle: {
    max: config.bullmq.providerRateLimitMax,
    duration: config.bullmq.providerRateLimitDurationMs,
  },
} as const;

export const LINE_NOTIFICATION_DISPATCH_JOB_DATA: LineNotificationDispatchJobData = {
  version: LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
};
