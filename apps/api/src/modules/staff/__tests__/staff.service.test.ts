/**
 * Unit tests for staffService.
 *
 * Strategy: mock repositories + queueService (data layer) while keeping the
 * service logic intact.
 */

import type { AuditLogRow } from '../../../db/repositories/audit-log.repository';
import { auditLogRepository } from '../../../db/repositories/audit-log.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';
import { QueueRow, queuesRepository } from '../../../db/repositories/queues.repository';
import { queueService } from '../../queue/queue.service';
import { staffService } from '../staff.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/audit-log.repository');
jest.mock('../../queue/queue.service');

// db/client must be mocked so repository module loads cleanly
jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  closePool: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
}));

// ── Typed handles ─────────────────────────────────────────────────────────────

const mockFindQueueById = queuesRepository.findById as jest.MockedFunction<
  typeof queuesRepository.findById
>;
const mockFindEntryById = queueEntriesRepository.findById as jest.MockedFunction<
  typeof queueEntriesRepository.findById
>;
const mockListWaiting = queueEntriesRepository.listWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.listWaiting
>;
const mockFindByQueueAndStatus = queueEntriesRepository.findByQueueAndStatus as jest.MockedFunction<
  typeof queueEntriesRepository.findByQueueAndStatus
>;
const mockMarkCancelled = queueEntriesRepository.markCancelled as jest.MockedFunction<
  typeof queueEntriesRepository.markCancelled
>;
const mockAuditCreate = auditLogRepository.create as jest.MockedFunction<
  typeof auditLogRepository.create
>;

const mockCallNextTicket = queueService.callNextTicket as jest.MockedFunction<
  typeof queueService.callNextTicket
>;
const mockServeTicket = queueService.serveTicket as jest.MockedFunction<
  typeof queueService.serveTicket
>;
const mockCompleteTicket = queueService.completeTicket as jest.MockedFunction<
  typeof queueService.completeTicket
>;
const mockNoShowTicket = queueService.noShowTicket as jest.MockedFunction<
  typeof queueService.noShowTicket
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUEUE_ID = '00000000-0000-0000-0000-000000000001';
const ENTRY_ID = '00000000-0000-0000-0000-000000000002';
const ACTOR_ID = '00000000-0000-0000-0000-000000000003';

const baseQueue: QueueRow = {
  id: QUEUE_ID,
  organization_id: '00000000-0000-0000-0000-000000000010',
  name: 'Test Queue',
  description: null,
  status: 'open',
  queue_type: 'standard',
  prefix: 'A',
  max_capacity: null,
  daily_ticket_counter: 5,
  last_counter_reset_at: new Date(),
  avg_service_seconds: 120,
  notify_ahead_positions: 3,
  allow_skip: true,
  max_skips_before_penalty: 2,
  opens_at: null,
  closes_at: null,
  settings: {},
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const baseEntry: QueueEntryRow = {
  id: ENTRY_ID,
  queue_id: QUEUE_ID,
  user_id: ACTOR_ID,
  line_user_id: null,
  ticket_number: 1,
  ticket_display: 'A001',
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
  created_at: new Date(),
  updated_at: new Date(),
};

const auditLogRow: AuditLogRow = {
  id: 'audit-001',
  actor_id: ACTOR_ID,
  actor_type: 'staff',
  action: 'staff.action',
  resource_type: 'queue_entry',
  resource_id: ENTRY_ID,
  organization_id: baseQueue.organization_id,
  changes: null,
  ip_address: null,
  user_agent: null,
  created_at: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Audit log should succeed silently by default
  mockAuditCreate.mockResolvedValue(auditLogRow);
  mockFindQueueById.mockResolvedValue(baseQueue);
});

// ── getQueueOverview ───────────────────────────────────────────────────────────

describe('staffService.getQueueOverview', () => {
  it('returns overview with waiting entries and null called/serving when queue is empty', async () => {
    mockFindQueueById.mockResolvedValue(baseQueue);
    mockListWaiting.mockResolvedValue([]);
    mockFindByQueueAndStatus.mockResolvedValue(null);

    const overview = await staffService.getQueueOverview(QUEUE_ID);

    expect(overview.queueId).toBe(QUEUE_ID);
    expect(overview.queueName).toBe('Test Queue');
    expect(overview.waitingCount).toBe(0);
    expect(overview.calledEntry).toBeNull();
    expect(overview.servingEntry).toBeNull();
  });

  it('returns called and serving entries when present', async () => {
    const calledEntry = { ...baseEntry, status: 'called' };
    const servingEntry = { ...baseEntry, id: 'other-id', status: 'serving' };

    mockFindQueueById.mockResolvedValue(baseQueue);
    mockListWaiting.mockResolvedValue([]);
    mockFindByQueueAndStatus
      .mockResolvedValueOnce(calledEntry) // called
      .mockResolvedValueOnce(servingEntry); // serving

    const overview = await staffService.getQueueOverview(QUEUE_ID);

    expect(overview.calledEntry?.status).toBe('called');
    expect(overview.servingEntry?.status).toBe('serving');
  });

  it('throws 404 when queue not found', async () => {
    mockFindQueueById.mockResolvedValue(null);

    await expect(staffService.getQueueOverview(QUEUE_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── callNext ──────────────────────────────────────────────────────────────────

describe('staffService.callNext', () => {
  it('calls queueService.callNextTicket and writes audit log', async () => {
    const called = { ...baseEntry, status: 'called' };
    mockCallNextTicket.mockResolvedValue(called);

    const result = await staffService.callNext(QUEUE_ID, ACTOR_ID);

    expect(result.status).toBe('called');
    expect(mockCallNextTicket).toHaveBeenCalledWith(QUEUE_ID, undefined, undefined, undefined);
  });

  it('propagates errors from callNextTicket', async () => {
    mockCallNextTicket.mockRejectedValue({ statusCode: 409, message: 'No waiting entries' });

    await expect(staffService.callNext(QUEUE_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ── serve ─────────────────────────────────────────────────────────────────────

describe('staffService.serve', () => {
  it('calls serveTicket and writes audit log', async () => {
    const serving = { ...baseEntry, status: 'serving' };
    mockServeTicket.mockResolvedValue(serving);

    const result = await staffService.serve(ENTRY_ID, ACTOR_ID);

    expect(result.status).toBe('serving');
    expect(mockServeTicket).toHaveBeenCalledWith({ entryId: ENTRY_ID, actorUserId: ACTOR_ID });
  });
});

// ── complete ──────────────────────────────────────────────────────────────────

describe('staffService.complete', () => {
  it('calls completeTicket and writes audit log', async () => {
    const completed = { ...baseEntry, status: 'completed' };
    mockCompleteTicket.mockResolvedValue(completed);

    const result = await staffService.complete(ENTRY_ID, ACTOR_ID);

    expect(result.status).toBe('completed');
    expect(mockCompleteTicket).toHaveBeenCalledWith({ entryId: ENTRY_ID, actorUserId: ACTOR_ID });
  });
});

// ── markNoShow ────────────────────────────────────────────────────────────────

describe('staffService.markNoShow', () => {
  it('calls noShowTicket and writes audit log', async () => {
    const noShow = { ...baseEntry, status: 'no_show' };
    mockNoShowTicket.mockResolvedValue(noShow);

    const result = await staffService.markNoShow(ENTRY_ID, ACTOR_ID);

    expect(result.status).toBe('no_show');
    expect(mockNoShowTicket).toHaveBeenCalledWith({ entryId: ENTRY_ID, actorUserId: ACTOR_ID });
  });

  it('propagates 409 when entry is not in called status', async () => {
    mockNoShowTicket.mockRejectedValue({ statusCode: 409, message: "must be in 'called'" });

    await expect(staffService.markNoShow(ENTRY_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

// ── cancelEntry ───────────────────────────────────────────────────────────────

describe('staffService.cancelEntry', () => {
  it('cancels a waiting entry', async () => {
    const cancelled = { ...baseEntry, status: 'cancelled' };
    mockFindEntryById.mockResolvedValue(baseEntry); // status: 'waiting'
    mockMarkCancelled.mockResolvedValue(cancelled);

    const result = await staffService.cancelEntry(ENTRY_ID, ACTOR_ID);

    expect(result.status).toBe('cancelled');
    expect(mockMarkCancelled).toHaveBeenCalledWith(ENTRY_ID);
  });

  it('cancels a called entry', async () => {
    const calledEntry = { ...baseEntry, status: 'called' };
    const cancelled = { ...calledEntry, status: 'cancelled' };
    mockFindEntryById.mockResolvedValue(calledEntry);
    mockMarkCancelled.mockResolvedValue(cancelled);

    const result = await staffService.cancelEntry(ENTRY_ID, ACTOR_ID);

    expect(result.status).toBe('cancelled');
  });

  it('throws 404 when entry not found', async () => {
    mockFindEntryById.mockResolvedValue(null);

    await expect(staffService.cancelEntry(ENTRY_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 409 when entry is already in a terminal status', async () => {
    mockFindEntryById.mockResolvedValue({ ...baseEntry, status: 'completed' });

    await expect(staffService.cancelEntry(ENTRY_ID, ACTOR_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
