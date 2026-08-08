import type { ConnectionOptions } from 'bullmq';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';

import { config } from '../../config';
import { runNotificationDelivery } from '../../jobs/notificationDelivery.job';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import {
  LINE_NOTIFICATION_DELIVERY_JOB_DATA,
  LINE_NOTIFICATION_DELIVERY_JOB_POLICY,
  LINE_NOTIFICATION_JOB_NAME,
  LINE_NOTIFICATION_QUEUE_NAME,
  LINE_NOTIFICATION_SCHEDULER_ID,
  type LineNotificationDeliveryJobData,
  lineNotificationDeliveryJobSchema,
} from './line-notification.contract';

export type BullMqRuntimeStatus = 'idle' | 'starting' | 'ready' | 'degraded' | 'closing';

export interface BullMqJobLike {
  name: string;
  data: unknown;
}

export interface BullMqQueuePort {
  waitUntilReady(): Promise<unknown>;
  upsertJobScheduler(
    schedulerId: string,
    repeat: { every: number },
    template: {
      name: string;
      data: LineNotificationDeliveryJobData;
      opts: {
        attempts: number;
        backoff: { type: 'exponential'; delay: number };
        removeOnComplete: number;
        removeOnFail: number;
      };
    }
  ): Promise<unknown>;
  close(): Promise<void>;
}

export interface BullMqWorkerPort {
  waitUntilReady(): Promise<unknown>;
  close(force?: boolean): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

export interface BullMqRuntimeFactory {
  createQueue(): BullMqQueuePort;
  createWorker(processor: (job: BullMqJobLike) => Promise<void>): BullMqWorkerPort;
}

interface BullMqRuntimeOptions {
  factory?: BullMqRuntimeFactory;
  delivery?: () => Promise<void>;
  startupTimeoutMs?: number;
  jobTimeoutMs?: number;
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function redisConnectionOptions(worker: boolean): ConnectionOptions {
  if (!config.redis.url) throw new Error('REDIS_URL is required for the BullMQ worker');
  const url = new URL(config.redis.url);
  return {
    host: url.hostname,
    port: Number.parseInt(url.port || '6379', 10),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number.parseInt(url.pathname.slice(1), 10) : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    connectTimeout: config.redis.connectTimeoutMs,
    enableReadyCheck: true,
    enableOfflineQueue: worker,
    maxRetriesPerRequest: worker ? null : 1,
  };
}

function createDefaultFactory(): BullMqRuntimeFactory {
  const prefix = `${config.redis.keyPrefix}:bullmq`;
  return {
    createQueue: () =>
      new Queue<LineNotificationDeliveryJobData, void, typeof LINE_NOTIFICATION_JOB_NAME>(
        LINE_NOTIFICATION_QUEUE_NAME,
        {
          connection: redisConnectionOptions(false),
          prefix,
        }
      ) as unknown as BullMqQueuePort,
    createWorker: (processor) =>
      new Worker<LineNotificationDeliveryJobData, void, typeof LINE_NOTIFICATION_JOB_NAME>(
        LINE_NOTIFICATION_QUEUE_NAME,
        (job: Job<LineNotificationDeliveryJobData, void, typeof LINE_NOTIFICATION_JOB_NAME>) =>
          processor(job),
        {
          connection: redisConnectionOptions(true),
          prefix,
          concurrency: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.concurrency,
          limiter: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.providerThrottle,
          lockDuration: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.timeoutMs,
          autorun: true,
        }
      ) as unknown as BullMqWorkerPort,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function processLineNotificationJob(
  job: BullMqJobLike,
  delivery: () => Promise<void> = runNotificationDelivery,
  timeoutMs = config.bullmq.jobTimeoutMs
): Promise<void> {
  const parsed = lineNotificationDeliveryJobSchema.safeParse(job.data);
  if (job.name !== LINE_NOTIFICATION_JOB_NAME || !parsed.success) {
    metricsService.increment('bullmq_invalid_jobs_total');
    throw new UnrecoverableError('Invalid LINE notification job contract');
  }

  await withTimeout(delivery(), timeoutMs, 'LINE notification delivery sweep timed out');
}

export class BullMqRuntime {
  private readonly factory: BullMqRuntimeFactory;
  private readonly delivery: () => Promise<void>;
  private readonly startupTimeoutMs: number;
  private readonly jobTimeoutMs: number;
  private queue: BullMqQueuePort | null = null;
  private worker: BullMqWorkerPort | null = null;
  private state: BullMqRuntimeStatus = 'idle';
  private activeJobs = 0;

  constructor(options: BullMqRuntimeOptions = {}) {
    this.factory = options.factory ?? createDefaultFactory();
    this.delivery = options.delivery ?? runNotificationDelivery;
    this.startupTimeoutMs = options.startupTimeoutMs ?? config.bullmq.startupTimeoutMs;
    this.jobTimeoutMs = options.jobTimeoutMs ?? config.bullmq.jobTimeoutMs;
  }

  status(): { status: BullMqRuntimeStatus; activeJobs: number } {
    return { status: this.state, activeJobs: this.activeJobs };
  }

  async start(): Promise<void> {
    if (this.state === 'ready' || this.state === 'starting') return;
    this.state = 'starting';

    try {
      this.queue = this.factory.createQueue();
      this.worker = this.factory.createWorker((job) =>
        processLineNotificationJob(job, this.delivery, this.jobTimeoutMs)
      );
      this.bindWorkerEvents(this.worker);

      await withTimeout(
        Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]),
        this.startupTimeoutMs,
        'BullMQ startup timed out'
      );
      await this.queue.upsertJobScheduler(
        LINE_NOTIFICATION_SCHEDULER_ID,
        { every: config.notifications.workerIntervalMs },
        {
          name: LINE_NOTIFICATION_JOB_NAME,
          data: LINE_NOTIFICATION_DELIVERY_JOB_DATA,
          opts: {
            attempts: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.attempts,
            backoff: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.backoff,
            removeOnComplete: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.removeOnComplete,
            removeOnFail: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.removeOnFail,
          },
        }
      );

      this.state = 'ready';
      metricsService.setGauge('bullmq_worker_ready', 1);
      logger.info(
        {
          queue: LINE_NOTIFICATION_QUEUE_NAME,
          job: LINE_NOTIFICATION_JOB_NAME,
          concurrency: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.concurrency,
        },
        'BullMQ worker ready'
      );
    } catch (error) {
      this.state = 'degraded';
      metricsService.increment('bullmq_worker_start_errors_total');
      metricsService.setGauge('bullmq_worker_ready', 0);
      logger.error({ errorType: errorType(error) }, 'BullMQ worker startup failed');
      await this.closeResources(true);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'idle') return;
    this.state = 'closing';
    metricsService.setGauge('bullmq_worker_ready', 0);
    await this.closeResources(false);
    this.activeJobs = 0;
    metricsService.setGauge('bullmq_worker_active_jobs', 0);
    this.state = 'idle';
    logger.info('BullMQ worker stopped');
  }

  private bindWorkerEvents(worker: BullMqWorkerPort): void {
    worker.on('active', () => {
      this.activeJobs += 1;
      metricsService.setGauge('bullmq_worker_active_jobs', this.activeJobs);
    });
    worker.on('completed', () => {
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      metricsService.increment('bullmq_jobs_completed_total');
      metricsService.setGauge('bullmq_worker_active_jobs', this.activeJobs);
    });
    worker.on('failed', (_job, error) => {
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      metricsService.increment('bullmq_jobs_failed_total');
      metricsService.setGauge('bullmq_worker_active_jobs', this.activeJobs);
      logger.warn({ errorType: errorType(error) }, 'BullMQ job failed');
    });
    worker.on('error', (error) => {
      if (this.state !== 'closing' && this.state !== 'idle') {
        this.state = 'degraded';
        metricsService.setGauge('bullmq_worker_ready', 0);
      }
      logger.error({ errorType: errorType(error) }, 'BullMQ worker connection error');
    });
    worker.on('ready', () => {
      if (this.state !== 'closing' && this.state !== 'idle') {
        this.state = 'ready';
        metricsService.setGauge('bullmq_worker_ready', 1);
      }
    });
  }

  private async closeResources(force: boolean): Promise<void> {
    const worker = this.worker;
    const queue = this.queue;
    this.worker = null;
    this.queue = null;

    if (worker) {
      try {
        await worker.close(force);
      } catch (error) {
        logger.warn(
          { errorType: errorType(error) },
          'BullMQ worker close did not complete cleanly'
        );
      }
    }
    if (queue) {
      try {
        await queue.close();
      } catch (error) {
        logger.warn({ errorType: errorType(error) }, 'BullMQ queue close did not complete cleanly');
      }
    }
  }
}

export const bullMqRuntime = new BullMqRuntime();
