import { UnrecoverableError } from 'bullmq';

import type {
  ILineMessagingAdapter,
  LineMessage,
  LineMessageOptions,
} from '../../modules/line/line.adapter';
import { MockLineAdapter } from '../../modules/line/line.mock.adapter';
import { LineProviderError } from '../../modules/line/line.sdk.adapter';
import type {
  NotificationOutboxRepository,
  NotificationOutboxRow,
} from '../../modules/notifications/notification-outbox.repository';
import {
  calculateNextRetryAt,
  classifyLineDeliveryError,
  deliverOutboxNotification,
  processOutboxNotificationJob,
  runNotificationDelivery,
} from '../notificationDelivery.job';

const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

function makeRow(override: Partial<NotificationOutboxRow> = {}): NotificationOutboxRow {
  return {
    id: NOTIFICATION_ID,
    organization_id: '22222222-2222-4222-8222-222222222222',
    queue_entry_id: '33333333-3333-4333-8333-333333333333',
    user_id: '44444444-4444-4444-8444-444444444444',
    line_user_id: 'U_test_001',
    event_key: 'queue_entry:entry-001:called',
    event_type: 'called',
    channel: 'line_push',
    status: 'processing',
    payload: { ticketCode: 'A005', aheadCount: 0, estimatedWaitSeconds: 0 },
    locale: 'ja',
    attempt_count: 1,
    max_attempts: 3,
    next_retry_at: null,
    processing_started_at: new Date('2026-08-08T10:00:00Z'),
    processing_job_id: `line-notification-${NOTIFICATION_ID}`,
    last_error: null,
    dispatch_status: 'dispatched',
    dispatch_attempt_count: 1,
    dispatch_next_retry_at: null,
    dispatch_started_at: null,
    dispatch_job_id: `line-notification-${NOTIFICATION_ID}`,
    dispatched_at: new Date('2026-08-08T10:00:00Z'),
    dispatch_last_error: null,
    sent_at: null,
    created_at: new Date('2026-08-08T10:00:00Z'),
    updated_at: new Date('2026-08-08T10:00:00Z'),
    ...override,
  };
}

function makeRepository(rows: NotificationOutboxRow[] = []) {
  return {
    claimDue: jest.fn().mockResolvedValue(rows),
    claimForDelivery: jest.fn().mockResolvedValue(rows[0] ?? null),
    markSent: jest.fn().mockResolvedValue(undefined),
    markRetry: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    deliveryMetrics: jest.fn().mockResolvedValue({
      pending: '0',
      retrying: '0',
      failed: '0',
      oldest_pending_seconds: '0',
      latency_seconds: '0',
    }),
  } as unknown as jest.Mocked<NotificationOutboxRepository>;
}

class SequenceLineAdapter implements ILineMessagingAdapter {
  readonly pushCalls: LineMessage[][] = [];

  constructor(private readonly outcomes: Array<unknown | null>) {}

  async pushMessage(
    _to: string,
    messages: LineMessage[],
    _options?: LineMessageOptions
  ): Promise<void> {
    this.pushCalls.push(messages);
    const outcome = this.outcomes.shift();
    if (outcome) throw outcome;
  }

  async replyMessage(): Promise<void> {
    throw new Error('not used');
  }
}

describe('notification delivery', () => {
  const now = () => new Date('2026-08-08T10:00:00Z');
  const random = () => 1;

  beforeEach(() => jest.clearAllMocks());

  it('keeps the native fallback path compatible while production uses BullMQ', async () => {
    const row = makeRow();
    const repository = makeRepository([row]);
    const adapter = new MockLineAdapter();

    await runNotificationDelivery({ repository, adapter, batchSize: 10, now, random });

    expect(repository.claimDue).toHaveBeenCalledWith(10);
    expect(adapter.pushCalls).toHaveLength(1);
    expect(repository.markSent).toHaveBeenCalledWith(NOTIFICATION_ID);
  });

  it('uses text fallback and marks sent when Flex delivery is rejected', async () => {
    const repository = makeRepository();
    const adapter = new SequenceLineAdapter([new Error('Flex rejected'), null]);

    await deliverOutboxNotification(makeRow(), { repository, adapter, now, random });

    expect(adapter.pushCalls.map((messages) => messages[0]?.type)).toEqual(['flex', 'text']);
    expect(repository.markSent).toHaveBeenCalledWith(NOTIFICATION_ID);
  });

  it('claims and sends one deterministic BullMQ notification job', async () => {
    const row = makeRow();
    const repository = makeRepository([row]);
    const adapter = new MockLineAdapter();

    await processOutboxNotificationJob(NOTIFICATION_ID, `line-notification-${NOTIFICATION_ID}`, {
      repository,
      adapter,
      now,
      random,
    });

    expect(repository.claimForDelivery).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      `line-notification-${NOTIFICATION_ID}`
    );
    expect(adapter.pushCalls[0]?.options?.retryKey).toBe(NOTIFICATION_ID);
    expect(repository.markSent).toHaveBeenCalledWith(NOTIFICATION_ID);
  });

  it('makes duplicate worker execution a no-op after the durable row is no longer claimable', async () => {
    const repository = makeRepository([makeRow()]);
    repository.claimForDelivery.mockResolvedValueOnce(makeRow()).mockResolvedValueOnce(null);
    const adapter = new MockLineAdapter();

    await processOutboxNotificationJob(NOTIFICATION_ID, 'same-job', {
      repository,
      adapter,
      now,
      random,
    });
    await processOutboxNotificationJob(NOTIFICATION_ID, 'same-job', {
      repository,
      adapter,
      now,
      random,
    });

    expect(adapter.pushCalls).toHaveLength(1);
  });

  it.each([
    ['timeout', new Error('request timed out')],
    [
      '429',
      new LineProviderError('rate limited', {
        statusCode: 429,
        retryAfterMs: 120_000,
        retryable: true,
      }),
    ],
    ['5xx', new LineProviderError('provider unavailable', { statusCode: 503, retryable: true })],
  ])('schedules a bounded BullMQ retry for retryable %s failures', async (_name, error) => {
    const repository = makeRepository([makeRow({ attempt_count: 2, max_attempts: 5 })]);
    const adapter = new SequenceLineAdapter([error, error]);

    await expect(
      processOutboxNotificationJob(NOTIFICATION_ID, 'delivery-job', {
        repository,
        adapter,
        now,
        random,
      })
    ).rejects.toBe(error);

    expect(repository.markRetry).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      _name === '429' ? new Date('2026-08-08T10:02:00Z') : new Date('2026-08-08T10:01:00Z'),
      error
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks permanent provider validation errors failed without retrying', async () => {
    const error = new LineProviderError('invalid message', {
      statusCode: 400,
      retryable: false,
    });
    const repository = makeRepository([makeRow()]);
    const adapter = new SequenceLineAdapter([error, error]);

    await expect(
      processOutboxNotificationJob(NOTIFICATION_ID, 'delivery-job', {
        repository,
        adapter,
        now,
        random,
      })
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(repository.markFailed).toHaveBeenCalledWith(NOTIFICATION_ID, error);
    expect(repository.markRetry).not.toHaveBeenCalled();
  });

  it('marks exhausted attempts failed and stops BullMQ retries', async () => {
    const error = new Error('LINE unavailable');
    const repository = makeRepository([makeRow({ attempt_count: 5, max_attempts: 5 })]);
    const adapter = new SequenceLineAdapter([error, error]);

    await expect(
      processOutboxNotificationJob(NOTIFICATION_ID, 'delivery-job', {
        repository,
        adapter,
        now,
        random,
      })
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(repository.markFailed).toHaveBeenCalledWith(NOTIFICATION_ID, error);
  });

  it('classifies provider 4xx as permanent and 429/5xx/network as retryable', () => {
    expect(
      classifyLineDeliveryError(
        new LineProviderError('bad request', { statusCode: 400, retryable: false })
      )
    ).toEqual({ retryable: false, retryAfterMs: null });
    expect(
      classifyLineDeliveryError(
        new LineProviderError('rate limited', {
          statusCode: 429,
          retryAfterMs: 10_000,
          retryable: true,
        })
      )
    ).toEqual({ retryable: true, retryAfterMs: 10_000 });
    expect(classifyLineDeliveryError(new Error('socket timeout')).retryable).toBe(true);
  });

  it('calculates exponential retry with jitter and honors provider Retry-After', () => {
    expect(calculateNextRetryAt(3, now(), 30, 0, () => 1)).toEqual(
      new Date('2026-08-08T10:02:00Z')
    );
    expect(calculateNextRetryAt(1, now(), 30, 120_000, () => 0)).toEqual(
      new Date('2026-08-08T10:02:00Z')
    );
  });
});
