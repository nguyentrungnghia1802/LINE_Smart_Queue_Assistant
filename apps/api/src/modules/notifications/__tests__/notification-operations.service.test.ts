jest.mock('../../../db/transaction', () => ({ withTransaction: jest.fn() }));
jest.mock('../notification-operations.repository', () => ({
  notificationOperationsRepository: {
    list: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    retryFailed: jest.fn(),
    cancelObsoletePending: jest.fn(),
    insertAudit: jest.fn(),
  },
}));

import { withTransaction } from '../../../db/transaction';
import { notificationOperationsRepository } from '../notification-operations.repository';
import {
  classifyNotificationFailure,
  notificationOperationsService,
  sanitizeOperationalError,
} from '../notification-operations.service';

const client = {} as never;
const baseRow = {
  id: '11111111-1111-4111-8111-111111111111',
  organization_id: '22222222-2222-4222-8222-222222222222',
  organization_name: 'Queue Lab',
  branch_id: '33333333-3333-4333-8333-333333333333',
  branch_name: 'Tokyo',
  queue_entry_id: '44444444-4444-4444-8444-444444444444',
  queue_name: 'Reception',
  ticket_code: 'A019',
  ticket_status: 'served',
  user_id: null,
  line_user_id: 'U1234567890',
  event_key: 'queue_entry:entry:called',
  event_type: 'called' as const,
  channel: 'line_push',
  status: 'failed' as const,
  payload: { private: 'not returned' },
  locale: 'ja' as const,
  attempt_count: 5,
  max_attempts: 5,
  manual_retry_count: 0,
  next_retry_at: null,
  processing_started_at: null,
  processing_job_id: null,
  last_error: 'provider 503 for U1234567890 with Bearer secret-token',
  dispatch_status: 'dispatched' as const,
  dispatch_attempt_count: 1,
  dispatch_next_retry_at: null,
  dispatch_started_at: null,
  dispatch_job_id: 'job-1',
  dispatched_at: new Date('2026-08-10T01:00:00Z'),
  dispatch_last_error: null,
  sent_at: null,
  operator_note: null,
  created_at: new Date('2026-08-10T01:00:00Z'),
  updated_at: new Date('2026-08-10T01:01:00Z'),
};

const branchScope = {
  organizationId: baseRow.organization_id,
  branchId: baseRow.branch_id,
};

const staffScope = {
  organizationId: baseRow.organization_id,
  branchId: baseRow.branch_id,
  queueId: '55555555-5555-4555-8555-555555555555',
};

describe('notificationOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
  });

  it('passes branch scope, pagination, event, and time filters to the repository', async () => {
    jest.mocked(notificationOperationsRepository.list).mockResolvedValue({
      rows: [{ ...baseRow, total_count: '1' }],
      total: 1,
    });

    const result = await notificationOperationsService.list({
      ...branchScope,
      status: 'failed',
      eventType: 'called',
      createdFrom: new Date('2026-08-01T00:00:00Z'),
      createdTo: new Date('2026-08-10T23:59:59Z'),
      page: 2,
      limit: 20,
    });

    expect(notificationOperationsRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: baseRow.organization_id,
        branchId: baseRow.branch_id,
      })
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ lineRecipient: 'U1***7890', canRetry: true });
    expect(result.items[0]).not.toHaveProperty('payload');
    expect(result.items[0]).not.toHaveProperty('lastError');
  });

  it('passes staff queue scope through to the repository', async () => {
    jest.mocked(notificationOperationsRepository.list).mockResolvedValue({
      rows: [{ ...baseRow, total_count: '1' }],
      total: 1,
    });

    await notificationOperationsService.list({
      ...staffScope,
      page: 1,
      limit: 20,
    });

    expect(notificationOperationsRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: staffScope.organizationId,
        branchId: staffScope.branchId,
        queueId: staffScope.queueId,
      })
    );
  });

  it('sanitizes recipient identifiers, tokens, emails, and URL queries in detail errors', async () => {
    jest.mocked(notificationOperationsRepository.findById).mockResolvedValue({
      ...baseRow,
      last_error:
        'failed U1234567890 Bearer token-123 user@example.com https://line.me/send?secret=value',
    });

    const result = await notificationOperationsService.detail(baseRow.id, branchScope);

    expect(result.sanitizedLastError).toContain('[LINE user redacted]');
    expect(result.sanitizedLastError).toContain('Bearer [redacted]');
    expect(result.sanitizedLastError).toContain('[email redacted]');
    expect(result.sanitizedLastError).not.toContain('secret=value');
  });

  it('retries only retryable failed deliveries and records one audited reason', async () => {
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue(baseRow);
    jest.mocked(notificationOperationsRepository.retryFailed).mockResolvedValue({
      ...baseRow,
      status: 'pending',
      attempt_count: 0,
      manual_retry_count: 1,
      last_error: null,
    });

    const result = await notificationOperationsService.retry({
      id: baseRow.id,
      scope: branchScope,
      actorId: '55555555-5555-4555-8555-555555555555',
      reason: 'Provider recovered',
    });

    expect(notificationOperationsRepository.retryFailed).toHaveBeenCalledTimes(1);
    expect(notificationOperationsRepository.insertAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        action: 'notification_manual_retry',
        reason: 'Provider recovered',
        failureCategory: 'provider_5xx',
      })
    );
    expect(result.status).toBe('pending');
  });

  it('allows staff to retry with queue-scoped access', async () => {
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue(baseRow);
    jest.mocked(notificationOperationsRepository.retryFailed).mockResolvedValue({
      ...baseRow,
      status: 'pending',
      attempt_count: 0,
      manual_retry_count: 1,
      last_error: null,
    });

    const result = await notificationOperationsService.retry({
      id: baseRow.id,
      scope: staffScope,
      actorId: 'staff-actor',
      reason: 'Provider recovered',
    });

    expect(result.status).toBe('pending');
    expect(notificationOperationsRepository.insertAudit).toHaveBeenCalledTimes(1);
  });

  it('rejects permanent recipient failures without mutating or auditing', async () => {
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue({
      ...baseRow,
      last_error: 'The recipient has blocked this LINE Official Account',
    });

    await expect(
      notificationOperationsService.retry({
        id: baseRow.id,
        scope: branchScope,
        actorId: 'actor',
        reason: 'Try again',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(notificationOperationsRepository.retryFailed).not.toHaveBeenCalled();
    expect(notificationOperationsRepository.insertAudit).not.toHaveBeenCalled();
  });

  it('cancels only pending deliveries for terminal tickets and is idempotent after cancellation', async () => {
    const pending = { ...baseRow, status: 'pending' as const, last_error: null };
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue(pending);
    jest.mocked(notificationOperationsRepository.cancelObsoletePending).mockResolvedValue({
      ...pending,
      status: 'cancelled',
    });

    await notificationOperationsService.cancel({
      id: baseRow.id,
      scope: branchScope,
      actorId: 'actor',
      reason: 'Ticket already completed',
    });
    expect(notificationOperationsRepository.cancelObsoletePending).toHaveBeenCalledTimes(1);
    expect(notificationOperationsRepository.insertAudit).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue({
      ...pending,
      status: 'cancelled',
    });
    const repeated = await notificationOperationsService.cancel({
      id: baseRow.id,
      scope: branchScope,
      actorId: 'actor',
      reason: 'Ticket already completed',
    });
    expect(repeated.status).toBe('cancelled');
    expect(notificationOperationsRepository.cancelObsoletePending).not.toHaveBeenCalled();
    expect(notificationOperationsRepository.insertAudit).not.toHaveBeenCalled();
  });

  it('rejects cancellation when the ticket is still active', async () => {
    jest.mocked(notificationOperationsRepository.findByIdForUpdate).mockResolvedValue({
      ...baseRow,
      status: 'pending',
      ticket_status: 'waiting',
      last_error: null,
    });
    await expect(
      notificationOperationsService.cancel({
        id: baseRow.id,
        scope: branchScope,
        actorId: 'actor',
        reason: 'Not needed',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('normalizes provider failure categories', () => {
    expect(classifyNotificationFailure('HTTP 429 rate limit')).toBe('rate_limited');
    expect(classifyNotificationFailure('ETIMEDOUT')).toBe('timeout');
    expect(classifyNotificationFailure('HTTP 503')).toBe('provider_5xx');
    expect(sanitizeOperationalError('Bearer abc')).toBe('Bearer [redacted]');
  });
});
