import { UnrecoverableError } from 'bullmq';

import { LineProviderError } from '../../../modules/line/line.sdk.adapter';
import type { NotificationDispatchQueue } from '../../../modules/notifications/notification-dispatcher.service';
import { metricsService } from '../../../utils/metrics';
import {
  type BullMqJobLike,
  type BullMqQueuePort,
  BullMqRuntime,
  type BullMqRuntimeFactory,
  type BullMqWorkerPort,
  calculateProviderBackoff,
  processLineNotificationJob,
} from '../bullmq.runtime';
import {
  LINE_NOTIFICATION_DELIVERY_JOB_NAME,
  LINE_NOTIFICATION_DISPATCH_JOB_NAME,
  LINE_NOTIFICATION_DISPATCH_JOB_POLICY,
  LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
  LINE_NOTIFICATION_SCHEDULER_ID,
} from '../line-notification.contract';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

class FakeQueue implements BullMqQueuePort {
  readonly schedulerIds: Set<string>;
  readonly events: string[];
  readyError: Error | null = null;
  counts = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  add = jest.fn().mockResolvedValue({ id: `line-notification-${NOTIFICATION_ID}` });
  upsertCalls: Array<{ id: string; every: number; name: string; data: unknown; opts: unknown }> =
    [];

  constructor(schedulerIds = new Set<string>(), events: string[] = []) {
    this.schedulerIds = schedulerIds;
    this.events = events;
  }

  async waitUntilReady(): Promise<void> {
    if (this.readyError) throw this.readyError;
  }

  async upsertJobScheduler(
    schedulerId: string,
    repeat: { every: number },
    template: Parameters<BullMqQueuePort['upsertJobScheduler']>[2]
  ): Promise<void> {
    this.schedulerIds.add(schedulerId);
    this.upsertCalls.push({ id: schedulerId, every: repeat.every, ...template });
  }

  async getJobCounts(): Promise<Record<'waiting' | 'active' | 'delayed' | 'failed', number>> {
    return this.counts;
  }

  async close(): Promise<void> {
    this.events.push('queue.close');
  }
}

class FakeWorker implements BullMqWorkerPort {
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  readyError: Error | null = null;
  closeBarrier: Promise<void> | null = null;

  constructor(private readonly events: string[] = []) {}

  async waitUntilReady(): Promise<void> {
    if (this.readyError) throw this.readyError;
  }

  async close(force = false): Promise<void> {
    this.events.push(force ? 'worker.force-close' : 'worker.close');
    if (this.closeBarrier) await this.closeBarrier;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

class FakeFactory implements BullMqRuntimeFactory {
  readonly queues: FakeQueue[] = [];
  readonly workers: FakeWorker[] = [];
  readonly processors: Array<(job: BullMqJobLike) => Promise<void>> = [];

  constructor(
    private readonly schedulerIds = new Set<string>(),
    private readonly events: string[] = []
  ) {}

  createQueue(): FakeQueue {
    const queue = new FakeQueue(this.schedulerIds, this.events);
    this.queues.push(queue);
    return queue;
  }

  createWorker(processor: (job: BullMqJobLike) => Promise<void>): FakeWorker {
    const worker = new FakeWorker(this.events);
    this.workers.push(worker);
    this.processors.push(processor);
    return worker;
  }
}

function handlers() {
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
    delivery: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BullMqRuntime', () => {
  beforeEach(() => metricsService.resetForTests());

  it('starts the dispatcher scheduler and a scalable per-notification worker', async () => {
    const factory = new FakeFactory();
    const runtime = new BullMqRuntime({ factory, dispatch: jest.fn(), delivery: jest.fn() });

    await runtime.start();

    expect(factory.queues[0]?.upsertCalls).toEqual([
      {
        id: LINE_NOTIFICATION_SCHEDULER_ID,
        every: 15_000,
        name: LINE_NOTIFICATION_DISPATCH_JOB_NAME,
        data: { version: LINE_NOTIFICATION_JOB_CONTRACT_VERSION },
        opts: LINE_NOTIFICATION_DISPATCH_JOB_POLICY,
      },
    ]);
    expect(runtime.status()).toEqual({ status: 'ready', activeJobs: 0 });
    await runtime.stop();
  });

  it('fails fast but leaves PostgreSQL outbox rows untouched when Redis is unavailable', async () => {
    const factory = new FakeFactory();
    factory.createQueue = () => {
      const queue = new FakeQueue();
      queue.readyError = new Error('Redis unavailable');
      factory.queues.push(queue);
      return queue;
    };
    const runtime = new BullMqRuntime({ factory, startupTimeoutMs: 20 });

    await expect(runtime.start()).rejects.toThrow('Redis unavailable');

    expect(runtime.status().status).toBe('degraded');
    expect(metricsService.snapshot().bullmq_worker_start_errors_total).toBe(1);
  });

  it('recovers queued backlog after a worker restart', async () => {
    const factory = new FakeFactory();
    const delivery = jest.fn().mockResolvedValue(undefined);
    const runtime = new BullMqRuntime({ factory, delivery });

    await runtime.start();
    await runtime.stop();
    await runtime.start();
    await factory.processors[1]?.({
      id: `line-notification-${NOTIFICATION_ID}`,
      name: LINE_NOTIFICATION_DELIVERY_JOB_NAME,
      data: { version: 1, notificationId: NOTIFICATION_ID },
    });

    expect(delivery).toHaveBeenCalledWith(NOTIFICATION_ID, `line-notification-${NOTIFICATION_ID}`);
    await runtime.stop();
  });

  it('keeps one deterministic dispatcher scheduler across worker replicas', async () => {
    const schedulerIds = new Set<string>();
    const first = new BullMqRuntime({ factory: new FakeFactory(schedulerIds) });
    const second = new BullMqRuntime({ factory: new FakeFactory(schedulerIds) });

    await Promise.all([first.start(), second.start()]);

    expect([...schedulerIds]).toEqual([LINE_NOTIFICATION_SCHEDULER_ID]);
    await Promise.all([first.stop(), second.stop()]);
  });

  it('drains the worker before closing its queue', async () => {
    const events: string[] = [];
    const factory = new FakeFactory(new Set(), events);
    const runtime = new BullMqRuntime({ factory });
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => (release = resolve));

    await runtime.start();
    const worker = factory.workers[0];
    if (!worker) throw new Error('Expected worker to be created');
    worker.closeBarrier = barrier;
    const stopping = runtime.stop();
    await Promise.resolve();
    expect(events).toEqual(['worker.close']);
    release();
    await stopping;
    expect(events).toEqual(['worker.close', 'queue.close']);
  });
});

describe('LINE notification BullMQ contracts', () => {
  beforeEach(() => metricsService.resetForTests());

  it('routes dispatcher and delivery jobs without putting recipient data in Redis', async () => {
    const queue = new FakeQueue();
    const jobHandlers = handlers();

    await processLineNotificationJob(
      { name: LINE_NOTIFICATION_DISPATCH_JOB_NAME, data: { version: 1 } },
      queue,
      jobHandlers,
      100
    );
    await processLineNotificationJob(
      {
        id: `line-notification-${NOTIFICATION_ID}`,
        name: LINE_NOTIFICATION_DELIVERY_JOB_NAME,
        data: { version: 1, notificationId: NOTIFICATION_ID },
      },
      queue,
      jobHandlers,
      100
    );

    expect(jobHandlers.dispatch).toHaveBeenCalledWith(queue as NotificationDispatchQueue);
    expect(jobHandlers.delivery).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      `line-notification-${NOTIFICATION_ID}`
    );
  });

  it('accepts W3C trace context while keeping the delivery handler contract PII-free', async () => {
    const queue = new FakeQueue();
    const jobHandlers = handlers();

    await processLineNotificationJob(
      {
        id: 'delivery-job',
        name: LINE_NOTIFICATION_DELIVERY_JOB_NAME,
        data: {
          version: 1,
          notificationId: NOTIFICATION_ID,
          traceContext: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        },
      },
      queue,
      jobHandlers,
      100
    );

    expect(jobHandlers.delivery).toHaveBeenCalledWith(NOTIFICATION_ID, 'delivery-job');
  });

  it.each([
    { name: 'unknown.job', data: { version: 1 } },
    { name: LINE_NOTIFICATION_DISPATCH_JOB_NAME, data: { version: 2 } },
    {
      id: 'job',
      name: LINE_NOTIFICATION_DELIVERY_JOB_NAME,
      data: { version: 1, notificationId: 'not-a-uuid' },
    },
  ])('rejects invalid contracts without retry', async (job) => {
    await expect(
      processLineNotificationJob(job, new FakeQueue(), handlers(), 100)
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(metricsService.snapshot().bullmq_invalid_jobs_total).toBe(1);
  });

  it('uses exponential jitter and honors provider Retry-After', () => {
    const error = new LineProviderError('rate limited', {
      statusCode: 429,
      retryAfterMs: 90_000,
      retryable: true,
    });
    expect(calculateProviderBackoff(2, error, 30_000, () => 0)).toBe(90_000);
    expect(calculateProviderBackoff(2, new Error('timeout'), 30_000, () => 1)).toBe(60_000);
  });
});
