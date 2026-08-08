import { UnrecoverableError } from 'bullmq';

import { metricsService } from '../../../utils/metrics';
import {
  type BullMqJobLike,
  type BullMqQueuePort,
  BullMqRuntime,
  type BullMqRuntimeFactory,
  type BullMqWorkerPort,
  processLineNotificationJob,
} from '../bullmq.runtime';
import {
  LINE_NOTIFICATION_DELIVERY_JOB_POLICY,
  LINE_NOTIFICATION_JOB_CONTRACT_VERSION,
  LINE_NOTIFICATION_JOB_NAME,
  LINE_NOTIFICATION_SCHEDULER_ID,
} from '../line-notification.contract';

class FakeQueue implements BullMqQueuePort {
  readonly schedulerIds: Set<string>;
  readonly events: string[];
  readyError: Error | null = null;
  upsertCalls: Array<{
    id: string;
    every: number;
    name: string;
    data: unknown;
    opts: unknown;
  }> = [];

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
    template: {
      name: string;
      data: { version: 1 };
      opts: {
        attempts: number;
        backoff: { type: 'exponential'; delay: number };
        removeOnComplete: number;
        removeOnFail: number;
      };
    }
  ): Promise<void> {
    this.schedulerIds.add(schedulerId);
    this.upsertCalls.push({
      id: schedulerId,
      every: repeat.every,
      name: template.name,
      data: template.data,
      opts: template.opts,
    });
  }

  async close(): Promise<void> {
    this.events.push('queue.close');
  }
}

class FakeWorker implements BullMqWorkerPort {
  readonly events: string[];
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  readyError: Error | null = null;
  closeBarrier: Promise<void> | null = null;

  constructor(events: string[] = []) {
    this.events = events;
  }

  async waitUntilReady(): Promise<void> {
    if (this.readyError) throw this.readyError;
  }

  async close(force = false): Promise<void> {
    this.events.push(force ? 'worker.force-close' : 'worker.close');
    if (this.closeBarrier) await this.closeBarrier;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
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

describe('BullMqRuntime', () => {
  beforeEach(() => metricsService.resetForTests());

  it('starts a dedicated worker and registers the versioned delivery scheduler', async () => {
    const factory = new FakeFactory();
    const runtime = new BullMqRuntime({ factory, delivery: jest.fn() });

    await runtime.start();

    expect(runtime.status()).toEqual({ status: 'ready', activeJobs: 0 });
    expect(factory.queues[0].upsertCalls).toEqual([
      {
        id: LINE_NOTIFICATION_SCHEDULER_ID,
        every: 15_000,
        name: LINE_NOTIFICATION_JOB_NAME,
        data: { version: LINE_NOTIFICATION_JOB_CONTRACT_VERSION },
        opts: {
          attempts: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.attempts,
          backoff: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.backoff,
          removeOnComplete: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.removeOnComplete,
          removeOnFail: LINE_NOTIFICATION_DELIVERY_JOB_POLICY.removeOnFail,
        },
      },
    ]);
    expect(metricsService.toPrometheus()).toContain('line_queue_bullmq_worker_ready 1');
    await runtime.stop();
  });

  it('fails fast and closes partial resources when Redis is unavailable', async () => {
    const factory = new FakeFactory();
    const runtime = new BullMqRuntime({ factory, startupTimeoutMs: 20 });
    factory.createQueue = () => {
      const queue = new FakeQueue();
      queue.readyError = new Error('Redis unavailable');
      factory.queues.push(queue);
      return queue;
    };

    await expect(runtime.start()).rejects.toThrow('Redis unavailable');

    expect(runtime.status().status).toBe('degraded');
    expect(factory.workers[0].events).toContain('worker.force-close');
    expect(factory.queues[0].events).toContain('queue.close');
    expect(metricsService.snapshot().bullmq_worker_start_errors_total).toBe(1);
  });

  it('can stop and start again after a worker restart', async () => {
    const factory = new FakeFactory();
    const runtime = new BullMqRuntime({ factory });

    await runtime.start();
    await runtime.stop();
    await runtime.start();

    expect(factory.workers).toHaveLength(2);
    expect(factory.queues).toHaveLength(2);
    expect(runtime.status().status).toBe('ready');
    await runtime.stop();
  });

  it('waits for the worker to drain before closing the queue', async () => {
    const events: string[] = [];
    const factory = new FakeFactory(new Set(), events);
    const runtime = new BullMqRuntime({ factory });
    let releaseWorker!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseWorker = resolve;
    });

    await runtime.start();
    factory.workers[0].closeBarrier = barrier;
    const stopping = runtime.stop();
    await Promise.resolve();

    expect(events).toEqual(['worker.close']);
    releaseWorker();
    await stopping;
    expect(events).toEqual(['worker.close', 'queue.close']);
  });

  it('keeps one deterministic scheduler when multiple workers start', async () => {
    const schedulerIds = new Set<string>();
    const first = new BullMqRuntime({ factory: new FakeFactory(schedulerIds) });
    const second = new BullMqRuntime({ factory: new FakeFactory(schedulerIds) });

    await Promise.all([first.start(), second.start()]);

    expect([...schedulerIds]).toEqual([LINE_NOTIFICATION_SCHEDULER_ID]);
    await Promise.all([first.stop(), second.stop()]);
  });

  it('tracks completed and failed worker events without sensitive labels', async () => {
    const factory = new FakeFactory();
    const runtime = new BullMqRuntime({ factory });
    await runtime.start();

    factory.workers[0].emit('active');
    factory.workers[0].emit('completed');
    factory.workers[0].emit('active');
    factory.workers[0].emit('failed', undefined, new Error('provider unavailable'));

    expect(runtime.status().activeJobs).toBe(0);
    expect(metricsService.snapshot()).toMatchObject({
      bullmq_jobs_completed_total: 1,
      bullmq_jobs_failed_total: 1,
    });

    factory.workers[0].emit('error', new Error('Redis connection lost'));
    expect(runtime.status().status).toBe('degraded');
    expect(metricsService.toPrometheus()).toContain('line_queue_bullmq_worker_ready 0');

    factory.workers[0].emit('ready');
    expect(runtime.status().status).toBe('ready');
    expect(metricsService.toPrometheus()).toContain('line_queue_bullmq_worker_ready 1');
    await runtime.stop();
  });
});

describe('LINE notification BullMQ contract', () => {
  beforeEach(() => metricsService.resetForTests());

  it('reuses the existing notification delivery job for a valid contract', async () => {
    const delivery = jest.fn().mockResolvedValue(undefined);

    await processLineNotificationJob(
      { name: LINE_NOTIFICATION_JOB_NAME, data: { version: 1 } },
      delivery,
      100
    );

    expect(delivery).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'unknown.job', data: { version: 1 } },
    { name: LINE_NOTIFICATION_JOB_NAME, data: { version: 2 } },
    { name: LINE_NOTIFICATION_JOB_NAME, data: { version: 1, lineUserId: 'must-not-be-here' } },
  ])('rejects invalid or sensitive contract payloads without retry', async (job) => {
    const delivery = jest.fn();

    await expect(processLineNotificationJob(job, delivery, 100)).rejects.toBeInstanceOf(
      UnrecoverableError
    );

    expect(delivery).not.toHaveBeenCalled();
    expect(metricsService.snapshot().bullmq_invalid_jobs_total).toBe(1);
  });

  it('enforces the bounded job timeout', async () => {
    const delivery = jest.fn(() => new Promise<void>(() => undefined));

    await expect(
      processLineNotificationJob(
        { name: LINE_NOTIFICATION_JOB_NAME, data: { version: 1 } },
        delivery,
        5
      )
    ).rejects.toThrow('LINE notification delivery sweep timed out');
  });
});
