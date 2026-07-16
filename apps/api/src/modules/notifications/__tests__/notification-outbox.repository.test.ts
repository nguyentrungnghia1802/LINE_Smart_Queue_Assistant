jest.mock('../../../db/client', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryWithClient: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  closePool: jest.fn().mockResolvedValue(undefined),
}));

import type { PoolClient } from 'pg';

import { query, queryWithClient } from '../../../db/client';
import {
  buildQueueNotificationEventKey,
  NotificationOutboxRepository,
  sanitizeNotificationError,
} from '../notification-outbox.repository';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockQueryWithClient = queryWithClient as jest.MockedFunction<typeof queryWithClient>;

const row = {
  id: 'notification-001',
  event_key: 'queue_entry:entry-001:called',
};

describe('NotificationOutboxRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue([row]);
    mockQueryWithClient.mockResolvedValue([row]);
  });

  it('builds a unique event key from queue entry and event type', () => {
    expect(buildQueueNotificationEventKey('entry-001', 'called')).toBe(
      'queue_entry:entry-001:called'
    );
  });

  it('enqueues idempotently using ON CONFLICT on event_key', async () => {
    const repository = new NotificationOutboxRepository();

    await repository.enqueue({
      organizationId: 'org-001',
      queueEntryId: 'entry-001',
      userId: 'user-001',
      lineUserId: 'U_test_001',
      eventType: 'called',
      eventKey: 'queue_entry:entry-001:called',
      payload: { ticketCode: 'A005' },
    });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (event_key)');
    expect(sql).toContain("SELECT $1,$2,$3,$4,$5,$6,$7,'line_push','pending',$8,$9,NOW()");
    expect(sql).toContain('SELECT preferred_locale FROM users');
    expect(sql).toContain('SELECT default_locale FROM organizations');
    expect(sql).toContain('line_notification_preferences');
    expect(params).toContain('queue_entry:entry-001:called');
    expect(params).toContain('U_test_001');
    expect(JSON.stringify(params)).not.toContain('Channel access token');
  });

  it('uses the caller transaction client when enqueueing inside business transaction', async () => {
    const repository = new NotificationOutboxRepository();
    const client = { query: jest.fn() } as unknown as PoolClient;

    await repository.enqueue(
      {
        organizationId: 'org-001',
        queueEntryId: 'entry-001',
        lineUserId: 'U_test_001',
        eventType: 'booking_created',
        eventKey: 'queue_entry:entry-001:booking_created',
        payload: { ticketCode: 'A005' },
      },
      client
    );

    expect(mockQueryWithClient).toHaveBeenCalledWith(client, expect.any(String), expect.any(Array));
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('claims pending rows with row locks so concurrent workers skip claimed work', async () => {
    const repository = new NotificationOutboxRepository();

    await repository.claimDue(20);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain('processing_started_at < NOW()');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("status = 'processing'");
    expect(sql).toContain('attempt_count = n.attempt_count + 1');
    expect(params).toEqual([20, 300]);
  });

  it('sanitizes bearer tokens before storing retry errors', async () => {
    const repository = new NotificationOutboxRepository();

    await repository.markRetry(
      'notification-001',
      new Date('2024-01-01T10:00:30Z'),
      new Error('failed with Bearer secret-token-123')
    );

    const [, params] = mockQuery.mock.calls[0];
    expect(params?.[2]).toBe('failed with Bearer [redacted]');
  });

  it('keeps provider errors short and redacted', () => {
    const result = sanitizeNotificationError(`Bearer abc ${'x'.repeat(1000)}`);
    expect(result).toContain('Bearer [redacted]');
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
