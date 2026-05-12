/**
 * Unit tests for notificationScan.job.ts
 *
 * Strategy:
 *   - Mock db/client (required by BaseRepository indirect import path)
 *   - Mock queueEntriesRepository directly
 *   - Mock queueNotificationService to intercept notification calls
 *   - Verify fan-out behaviour, skip-on-empty, and error isolation
 */

jest.mock('../../db/client', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
  closePool: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../db/repositories/queue-entries.repository', () => ({
  queueEntriesRepository: {
    findNearThresholdWaiting: jest.fn(),
    findRecentlyCalled: jest.fn(),
  },
}));

jest.mock('../../modules/notifications/queue-notification.service', () => ({
  ETA_WARNING_THRESHOLD: 2,
  queueNotificationService: {
    notifyEtaWarning: jest.fn().mockResolvedValue(undefined),
    notifyTicketCalled: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import type { QueueEntryRow } from '../../db/repositories/queue-entries.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queueNotificationService } from '../../modules/notifications/queue-notification.service';
import { scanCalledRenotify, scanEtaWarnings } from '../notificationScan.job';

// Use runtime mocks so TypeScript is happy.
const mockRepo = jest.requireMock('../../db/repositories/queue-entries.repository')
  .queueEntriesRepository as jest.Mocked<typeof queueEntriesRepository>;

const mockNotif = jest.requireMock('../../modules/notifications/queue-notification.service')
  .queueNotificationService as jest.Mocked<typeof queueNotificationService>;

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeEntry(
  override: Partial<QueueEntryRow> & { ahead_count?: number } = {}
): QueueEntryRow & { ahead_count: number } {
  return {
    id: 'entry-001',
    queue_id: 'queue-001',
    user_id: null,
    line_user_id: 'U_test_001',
    ticket_number: 5,
    ticket_display: 'A005',
    status: 'waiting',
    skip_count: 0,
    priority: 0,
    notes: null,
    metadata: {},
    called_at: null,
    serving_at: null,
    completed_at: null,
    skipped_at: null,
    cancelled_at: null,
    estimated_call_at: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    ahead_count: 1,
    ...override,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── scanEtaWarnings ───────────────────────────────────────────────────────────

describe('scanEtaWarnings', () => {
  it('does nothing when no entries are near threshold', async () => {
    mockRepo.findNearThresholdWaiting.mockResolvedValue([]);
    await scanEtaWarnings();
    expect(mockNotif.notifyEtaWarning).not.toHaveBeenCalled();
  });

  it('calls notifyEtaWarning for each entry with correct ahead_count', async () => {
    const e1 = makeEntry({ id: 'e1', ahead_count: 1 });
    const e2 = makeEntry({ id: 'e2', ahead_count: 2 });
    mockRepo.findNearThresholdWaiting.mockResolvedValue([e1, e2]);

    await scanEtaWarnings();

    expect(mockNotif.notifyEtaWarning).toHaveBeenCalledTimes(2);
    expect(mockNotif.notifyEtaWarning).toHaveBeenCalledWith(e1, 1);
    expect(mockNotif.notifyEtaWarning).toHaveBeenCalledWith(e2, 2);
  });

  it('queries with the ETA_WARNING_THRESHOLD constant (2)', async () => {
    mockRepo.findNearThresholdWaiting.mockResolvedValue([]);
    await scanEtaWarnings();
    expect(mockRepo.findNearThresholdWaiting).toHaveBeenCalledWith(2);
  });

  it('continues processing other entries when one notification throws', async () => {
    const e1 = makeEntry({ id: 'e1', ahead_count: 1 });
    const e2 = makeEntry({ id: 'e2', ahead_count: 2 });
    mockRepo.findNearThresholdWaiting.mockResolvedValue([e1, e2]);
    mockNotif.notifyEtaWarning
      .mockRejectedValueOnce(new Error('LINE down'))
      .mockResolvedValue(undefined);

    // Must not throw even when one notification fails
    await expect(scanEtaWarnings()).resolves.toBeUndefined();

    expect(mockNotif.notifyEtaWarning).toHaveBeenCalledTimes(2);
  });

  it('does not throw when the repository call fails', async () => {
    mockRepo.findNearThresholdWaiting.mockRejectedValue(new Error('db error'));
    await expect(scanEtaWarnings()).rejects.toThrow('db error');
    // Note: repository errors propagate — the JobRunner retry wrapper handles them.
  });
});

// ── scanCalledRenotify ────────────────────────────────────────────────────────

describe('scanCalledRenotify', () => {
  it('does nothing when no recently-called entries exist', async () => {
    mockRepo.findRecentlyCalled.mockResolvedValue([]);
    await scanCalledRenotify();
    expect(mockNotif.notifyTicketCalled).not.toHaveBeenCalled();
  });

  it('calls notifyTicketCalled for each entry', async () => {
    const e1 = makeEntry({ id: 'e1', status: 'called' });
    const e2 = makeEntry({ id: 'e2', status: 'called' });
    mockRepo.findRecentlyCalled.mockResolvedValue([e1, e2]);

    await scanCalledRenotify();

    expect(mockNotif.notifyTicketCalled).toHaveBeenCalledTimes(2);
    expect(mockNotif.notifyTicketCalled).toHaveBeenCalledWith(e1);
    expect(mockNotif.notifyTicketCalled).toHaveBeenCalledWith(e2);
  });

  it('queries with age parameters (30 min max, 30 s min)', async () => {
    mockRepo.findRecentlyCalled.mockResolvedValue([]);
    await scanCalledRenotify();
    expect(mockRepo.findRecentlyCalled).toHaveBeenCalledWith(30, 30);
  });

  it('continues processing other entries when one notification throws', async () => {
    const e1 = makeEntry({ id: 'e1', status: 'called' });
    const e2 = makeEntry({ id: 'e2', status: 'called' });
    mockRepo.findRecentlyCalled.mockResolvedValue([e1, e2]);
    mockNotif.notifyTicketCalled
      .mockRejectedValueOnce(new Error('LINE timeout'))
      .mockResolvedValue(undefined);

    await expect(scanCalledRenotify()).resolves.toBeUndefined();
    expect(mockNotif.notifyTicketCalled).toHaveBeenCalledTimes(2);
  });

  it('propagates repository errors (handled by JobRunner retry)', async () => {
    mockRepo.findRecentlyCalled.mockRejectedValue(new Error('db error'));
    await expect(scanCalledRenotify()).rejects.toThrow('db error');
  });
});
