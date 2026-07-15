import type {
  ILineMessagingAdapter,
  LineMessage,
  LineMessageOptions,
} from '../../modules/line/line.adapter';
import { MockLineAdapter } from '../../modules/line/line.mock.adapter';
import type {
  NotificationOutboxRepository,
  NotificationOutboxRow,
} from '../../modules/notifications/notification-outbox.repository';
import {
  calculateNextRetryAt,
  deliverOutboxNotification,
  runNotificationDelivery,
} from '../notificationDelivery.job';

function makeRow(override: Partial<NotificationOutboxRow> = {}): NotificationOutboxRow {
  return {
    id: 'notification-001',
    organization_id: 'org-001',
    queue_entry_id: 'entry-001',
    user_id: 'user-001',
    line_user_id: 'U_test_001',
    type: 'queue_called',
    event_key: 'queue_entry:entry-001:called',
    event_type: 'called',
    channel: 'line_push',
    status: 'processing',
    payload: { ticketCode: 'A005', aheadCount: 0, estimatedWaitSeconds: 0 },
    retry_count: 1,
    attempt_count: 1,
    max_attempts: 3,
    next_retry_at: null,
    processing_started_at: new Date('2024-01-01T10:00:00Z'),
    error_message: null,
    last_error: null,
    sent_at: null,
    delivered_at: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    ...override,
  };
}

function makeRepository(rows: NotificationOutboxRow[] = []) {
  return {
    claimDue: jest.fn().mockResolvedValue(rows),
    markSent: jest.fn().mockResolvedValue(undefined),
    markRetry: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationOutboxRepository>;
}

class FailingLineAdapter implements ILineMessagingAdapter {
  async pushMessage(
    _to: string,
    _messages: LineMessage[],
    _options?: LineMessageOptions
  ): Promise<void> {
    throw new Error('LINE unavailable');
  }

  async replyMessage(): Promise<void> {
    throw new Error('not used');
  }
}

class FallbackLineAdapter implements ILineMessagingAdapter {
  readonly pushCalls: LineMessage[][] = [];
  private calls = 0;

  async pushMessage(
    _to: string,
    messages: LineMessage[],
    _options?: LineMessageOptions
  ): Promise<void> {
    this.calls += 1;
    this.pushCalls.push(messages);
    if (this.calls === 1) throw new Error('Flex rejected');
  }

  async replyMessage(): Promise<void> {
    throw new Error('not used');
  }
}

describe('notificationDelivery job', () => {
  const now = () => new Date('2024-01-01T10:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims due rows and marks a successful LINE delivery as sent', async () => {
    const row = makeRow();
    const repository = makeRepository([row]);
    const adapter = new MockLineAdapter();

    await runNotificationDelivery({ repository, adapter, batchSize: 10, now });

    expect(repository.claimDue).toHaveBeenCalledWith(10);
    expect(adapter.pushCalls).toHaveLength(1);
    expect(adapter.pushCalls[0].to).toBe('U_test_001');
    expect(adapter.pushCalls[0].messages[0].type).toBe('flex');
    expect(JSON.stringify(adapter.pushCalls[0].messages[0])).toContain(
      '%2Fliff%2Ftickets%2Fentry-001'
    );
    expect(repository.markSent).toHaveBeenCalledWith('notification-001');
    expect(repository.markRetry).not.toHaveBeenCalled();
  });

  it('uses text fallback and still marks sent when Flex delivery fails once', async () => {
    const repository = makeRepository();
    const adapter = new FallbackLineAdapter();

    await deliverOutboxNotification(makeRow(), { repository, adapter, now });

    expect(adapter.pushCalls).toHaveLength(2);
    expect(adapter.pushCalls[0][0].type).toBe('flex');
    expect(adapter.pushCalls[1][0].type).toBe('text');
    expect(repository.markSent).toHaveBeenCalledWith('notification-001');
  });

  it('schedules retry with exponential backoff when delivery fails below max attempts', async () => {
    const repository = makeRepository();
    const adapter = new FailingLineAdapter();

    await deliverOutboxNotification(makeRow({ attempt_count: 2, max_attempts: 5 }), {
      repository,
      adapter,
      now,
    });

    expect(repository.markRetry).toHaveBeenCalledWith(
      'notification-001',
      new Date('2024-01-01T10:01:00Z'),
      'LINE notification delivery failed'
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed after reaching the retry limit', async () => {
    const repository = makeRepository();
    const adapter = new FailingLineAdapter();

    await deliverOutboxNotification(makeRow({ attempt_count: 5, max_attempts: 5 }), {
      repository,
      adapter,
      now,
    });

    expect(repository.markFailed).toHaveBeenCalledWith(
      'notification-001',
      'LINE notification delivery failed'
    );
    expect(repository.markRetry).not.toHaveBeenCalled();
  });

  it('does not let one failed message block the rest of the batch', async () => {
    const repository = makeRepository([
      makeRow({ id: 'notification-001', line_user_id: null }),
      makeRow({ id: 'notification-002', line_user_id: 'U_test_002' }),
    ]);
    const adapter = new MockLineAdapter();

    await runNotificationDelivery({ repository, adapter, now });

    expect(repository.markFailed).toHaveBeenCalledWith('notification-001', 'Missing LINE user ID');
    expect(repository.markSent).toHaveBeenCalledWith('notification-002');
  });

  it('mock adapter records delivery without calling real LINE transport', async () => {
    const repository = makeRepository();
    const adapter = new MockLineAdapter();

    await deliverOutboxNotification(makeRow(), { repository, adapter, now });

    expect(adapter.pushCalls).toHaveLength(1);
    expect(repository.markSent).toHaveBeenCalledTimes(1);
  });

  it('calculates exponential retry delay from the claimed attempt count', () => {
    expect(calculateNextRetryAt(1, now(), 30)).toEqual(new Date('2024-01-01T10:00:30Z'));
    expect(calculateNextRetryAt(3, now(), 30)).toEqual(new Date('2024-01-01T10:02:00Z'));
  });
});
