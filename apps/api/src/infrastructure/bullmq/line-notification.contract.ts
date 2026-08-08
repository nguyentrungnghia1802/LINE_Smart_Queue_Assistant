import { z } from 'zod';

import { config } from '../../config';

export const LINE_NOTIFICATION_QUEUE_NAME = 'line-notifications';
export const LINE_NOTIFICATION_JOB_NAME = 'line.notification-delivery.sweep.v1';
export const LINE_NOTIFICATION_SCHEDULER_ID = 'line-notification-delivery-sweep-v1';
export const LINE_NOTIFICATION_JOB_CONTRACT_VERSION = 1 as const;

export const lineNotificationDeliveryJobSchema = z
  .object({
    version: z.literal(LINE_NOTIFICATION_JOB_CONTRACT_VERSION),
  })
  .strict();

export type LineNotificationDeliveryJobData = z.infer<typeof lineNotificationDeliveryJobSchema>;

export const LINE_NOTIFICATION_DELIVERY_JOB_POLICY = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1_000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
  timeoutMs: config.bullmq.jobTimeoutMs,
  concurrency: config.bullmq.workerConcurrency,
  providerThrottle: {
    max: 1,
    duration: config.notifications.workerIntervalMs,
  },
} as const;

export const LINE_NOTIFICATION_DELIVERY_JOB_DATA: LineNotificationDeliveryJobData = {
  version: LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
};
