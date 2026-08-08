import type { NotificationDispatchQueue } from '../notification-dispatcher.service';
import {
  calculateDispatchRetryAt,
  dispatchNotificationOutbox,
} from '../notification-dispatcher.service';
import type {
  NotificationOutboxRepository,
  NotificationOutboxRow,
} from '../notification-outbox.repository';

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
    status: 'pending',
    payload: { ticketCode: 'A005' },
    locale: 'ja',
    attempt_count: 0,
    max_attempts: 5,
    next_retry_at: null,
    processing_started_at: null,
    processing_job_id: null,
    last_error: null,
    dispatch_status: 'dispatching',
    dispatch_attempt_count: 1,
    dispatch_next_retry_at: null,
    dispatch_started_at: new Date('2026-08-08T00:00:00Z'),
    dispatch_job_id: `line-notification-${NOTIFICATION_ID}`,
    dispatched_at: null,
    dispatch_last_error: null,
    sent_at: null,
    created_at: new Date('2026-08-08T00:00:00Z'),
    updated_at: new Date('2026-08-08T00:00:00Z'),
    ...override,
  };
}

function makeRepository(rows: NotificationOutboxRow[]) {
  return {
    claimForDispatch: jest.fn().mockResolvedValue(rows),
    markDispatched: jest.fn().mockResolvedValue(undefined),
    markDispatchRetry: jest.fn().mockResolvedValue(undefined),
    dispatchMetrics: jest.fn().mockResolvedValue({ undispatched: '0', oldest_seconds: '0' }),
  } as unknown as jest.Mocked<NotificationOutboxRepository>;
}

function makeQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: `line-notification-${NOTIFICATION_ID}` }),
  } as jest.Mocked<NotificationDispatchQueue>;
}

describe('notification outbox dispatcher', () => {
  const now = () => new Date('2026-08-08T00:00:00Z');

  it('dispatches a committed row using a deterministic, data-minimal BullMQ job', async () => {
    const repository = makeRepository([makeRow()]);
    const queue = makeQueue();

    await dispatchNotificationOutbox(queue, { repository, now, random: () => 1 });

    expect(queue.add).toHaveBeenCalledWith(
      'line.notification-delivery.v1',
      { version: 1, notificationId: NOTIFICATION_ID },
      expect.objectContaining({
        jobId: `line-notification-${NOTIFICATION_ID}`,
        attempts: 5,
      })
    );
    expect(JSON.stringify(queue.add.mock.calls[0])).not.toContain('U_test_001');
    expect(repository.markDispatched).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      `line-notification-${NOTIFICATION_ID}`
    );
  });

  it('returns a claim to PostgreSQL when Redis is unavailable before enqueue', async () => {
    const repository = makeRepository([makeRow({ dispatch_attempt_count: 2 })]);
    const queue = makeQueue();
    queue.add.mockRejectedValueOnce(new Error('Redis unavailable'));

    await dispatchNotificationOutbox(queue, { repository, now, random: () => 1 });

    expect(repository.markDispatchRetry).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      new Date('2026-08-08T00:01:00Z'),
      expect.any(Error)
    );
    expect(repository.markDispatched).not.toHaveBeenCalled();
  });

  it('redispatches harmlessly with the same job id after enqueue succeeded before DB ack', async () => {
    const row = makeRow();
    const repository = makeRepository([row]);
    const queue = makeQueue();
    repository.markDispatched.mockRejectedValueOnce(new Error('DB acknowledgement interrupted'));

    await dispatchNotificationOutbox(queue, { repository, now, random: () => 1 });
    repository.claimForDispatch.mockResolvedValueOnce([makeRow({ dispatch_attempt_count: 2 })]);
    await dispatchNotificationOutbox(queue, { repository, now, random: () => 1 });

    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(queue.add.mock.calls[0]?.[2].jobId).toBe(queue.add.mock.calls[1]?.[2].jobId);
  });

  it('does not create another job when a concurrent dispatcher claimed no rows', async () => {
    const repository = makeRepository([]);
    const queue = makeQueue();

    await Promise.all([
      dispatchNotificationOutbox(queue, { repository }),
      dispatchNotificationOutbox(queue, { repository }),
    ]);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('bounds exponential dispatch retry and applies jitter', () => {
    const earliest = calculateDispatchRetryAt(10, now(), () => 0);
    const latest = calculateDispatchRetryAt(10, now(), () => 1);
    expect(earliest).toEqual(new Date('2026-08-08T00:02:30Z'));
    expect(latest).toEqual(new Date('2026-08-08T00:05:00Z'));
  });
});
