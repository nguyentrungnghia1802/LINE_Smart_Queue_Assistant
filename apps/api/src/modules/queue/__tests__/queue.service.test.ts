import { ordersRepository } from '../../../db/repositories/orders.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';
import { QueueRow, queuesRepository } from '../../../db/repositories/queues.repository';
import { withTransaction } from '../../../db/transaction';
import { publicReadModelCache } from '../../../infrastructure/redis/redis-json.cache';
import { inventoryService } from '../../inventory/inventory.service';
import { queueNotificationService } from '../../notifications/queue-notification.service';
import { paymentsService } from '../../payments/payments.service';
import { skipPenaltyService } from '../../skip-penalty/skip-penalty.service';
import { queueService } from '../queue.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/transaction');
jest.mock('../../../infrastructure/redis/redis-json.cache', () => ({
  publicReadModelCache: {
    getQueueSummary: jest.fn(
      async (params: { load: () => Promise<unknown> }) => await params.load()
    ),
    invalidateQueue: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../inventory/inventory.service');
jest.mock('../../notifications/queue-notification.service', () => ({
  ETA_WARNING_POSITIONS: [5],
  queueNotificationService: {
    notifyBookingCreated: jest.fn().mockResolvedValue(undefined),
    notifyTicketCancelled: jest.fn().mockResolvedValue(undefined),
    notifyTicketCalled: jest.fn().mockResolvedValue(undefined),
    notifyEtaWarning: jest.fn().mockResolvedValue(undefined),
    notifyTicketServing: jest.fn().mockResolvedValue(undefined),
    notifyTicketCompleted: jest.fn().mockResolvedValue(undefined),
    notifyTicketNoShow: jest.fn().mockResolvedValue(undefined),
    notifyTicketDeferred: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../skip-penalty/skip-penalty.service');
jest.mock('../../payments/payments.service', () => ({
  paymentsService: {
    refundOrderOnCancellationInClient: jest.fn().mockResolvedValue({
      refundedAmount: 0,
      transactionCount: 0,
    }),
  },
}));

// Mock orders repository so batchWorkloadForEntries returns an empty Map in tests.
jest.mock('../../../db/repositories/orders.repository', () => ({
  batchWorkloadForEntries: jest.fn().mockResolvedValue(new Map()),
  calculateWorkloadForEntries: jest.fn().mockResolvedValue(0),
  ordersRepository: {
    findByQueueEntry: jest.fn().mockResolvedValue(null),
    findByQueueEntries: jest.fn().mockResolvedValue(new Map()),
  },
}));

// db/client must be mocked so the penalty repository module loads cleanly
jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  closePool: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
}));

const mockFindQueueById = queuesRepository.findById as jest.MockedFunction<
  typeof queuesRepository.findById
>;
const mockLockQueueById = queuesRepository.lockById as jest.MockedFunction<
  typeof queuesRepository.lockById
>;
const mockCountWaiting = queuesRepository.countWaiting as jest.MockedFunction<
  typeof queuesRepository.countWaiting
>;
const mockGetWaitingPosition = queuesRepository.getWaitingPosition as jest.MockedFunction<
  typeof queuesRepository.getWaitingPosition
>;
const mockIncrementCounter = queuesRepository.incrementAndGetCounter as jest.MockedFunction<
  typeof queuesRepository.incrementAndGetCounter
>;
const mockFindEntryById = queueEntriesRepository.findById as jest.MockedFunction<
  typeof queueEntriesRepository.findById
>;
const mockFindActiveByUser = queueEntriesRepository.findActiveByUser as jest.MockedFunction<
  typeof queueEntriesRepository.findActiveByUser
>;
const mockFindActiveByLineUser = queueEntriesRepository.findActiveByLineUser as jest.MockedFunction<
  typeof queueEntriesRepository.findActiveByLineUser
>;
const mockFindAllActiveForActor =
  queueEntriesRepository.findAllActiveForActor as jest.MockedFunction<
    typeof queueEntriesRepository.findAllActiveForActor
  >;
const mockFindOrdersByQueueEntries = ordersRepository.findByQueueEntries as jest.MockedFunction<
  typeof ordersRepository.findByQueueEntries
>;
const mockGetEntryIdsAhead = queueEntriesRepository.getEntryIdsAhead as jest.MockedFunction<
  typeof queueEntriesRepository.getEntryIdsAhead
>;
const mockCreateEntry = queueEntriesRepository.create as jest.MockedFunction<
  typeof queueEntriesRepository.create
>;
const mockMarkCancelled = queueEntriesRepository.markCancelled as jest.MockedFunction<
  typeof queueEntriesRepository.markCancelled
>;
const mockDeprioritize = queueEntriesRepository.deprioritize as jest.MockedFunction<
  typeof queueEntriesRepository.deprioritize
>;
const mockListWaiting = queueEntriesRepository.listWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.listWaiting
>;
const mockFindByQueueAndStatus = queueEntriesRepository.findByQueueAndStatus as jest.MockedFunction<
  typeof queueEntriesRepository.findByQueueAndStatus
>;
const mockMarkCalled = queueEntriesRepository.markCalled as jest.MockedFunction<
  typeof queueEntriesRepository.markCalled
>;
const mockMarkServed = queueEntriesRepository.markServed as jest.MockedFunction<
  typeof queueEntriesRepository.markServed
>;
const mockMarkNoShow = queueEntriesRepository.markNoShow as jest.MockedFunction<
  typeof queueEntriesRepository.markNoShow
>;
const mockDeferCalledBySlots = queueEntriesRepository.deferCalledBySlots as jest.MockedFunction<
  typeof queueEntriesRepository.deferCalledBySlots
>;
const mockArchiveToHistory = queueEntriesRepository.archiveToHistory as jest.MockedFunction<
  typeof queueEntriesRepository.archiveToHistory
>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockQueueNotificationService = queueNotificationService as jest.Mocked<
  typeof queueNotificationService
>;
const mockCalcPriority = skipPenaltyService.calculatePriorityAdjustment as jest.MockedFunction<
  typeof skipPenaltyService.calculatePriorityAdjustment
>;
const mockOnSkipExhausted = skipPenaltyService.onSkipExhausted as jest.MockedFunction<
  typeof skipPenaltyService.onSkipExhausted
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUEUE_ID = 'queue-uuid-0001';
const BRANCH_ID = 'branch-uuid-0001';
const ENTRY_ID = 'entry-uuid-0001';
const USER_ID = 'user-uuid-0001';
const LINE_USER_ID = 'Uf0000000000000000000000000000001';

const openQueue: QueueRow = {
  id: QUEUE_ID,
  organization_id: 'org-uuid-0001',
  branch_id: BRANCH_ID,
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

const waitingEntry: QueueEntryRow = {
  id: ENTRY_ID,
  queue_id: QUEUE_ID,
  user_id: USER_ID,
  order_id: null,
  line_user_id: LINE_USER_ID,
  ticket_number: 6,
  ticket_code: 'A006',
  status: 'waiting',
  priority: 0,
  position_snapshot: null,
  called_at: null,
  serving_started_at: null,
  served_at: null,
  skipped_at: null,
  cancelled_at: null,
  no_show_at: null,
  estimated_wait_seconds: null,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Make withTransaction execute the callback with a dummy PoolClient. */
function mockTx() {
  mockWithTransaction.mockImplementation(async (fn) =>
    fn({
      query: jest.fn().mockResolvedValue({ rows: [{ pos: '2' }] }),
    } as never)
  );
}

// ── Global setup ──────────────────────────────────────────────────────────────

// Default: no penalties → priority adjustment = 0 (no deduction)
beforeEach(() => {
  mockCalcPriority.mockResolvedValue(0);
  mockOnSkipExhausted.mockResolvedValue(undefined);
  jest.mocked(inventoryService.consumeOrder).mockResolvedValue(0);
});

// ── joinQueue ─────────────────────────────────────────────────────────────────

describe('queueService.joinQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLockQueueById.mockResolvedValue(openQueue);
    mockCountWaiting.mockResolvedValue(0);
  });

  it('creates a new ticket and returns position info', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockFindActiveByUser.mockResolvedValue(null);
    mockFindActiveByLineUser.mockResolvedValue(null);
    mockIncrementCounter.mockResolvedValue({ ticketNumber: 6, businessDate: '2026-07-16' });
    mockCreateEntry.mockResolvedValue(waitingEntry);
    mockGetWaitingPosition.mockResolvedValue(2);
    mockTx();

    const result = await queueService.joinQueue({
      queueId: QUEUE_ID,
      userId: USER_ID,
      lineUserId: LINE_USER_ID,
    });

    expect(result.isExisting).toBe(false);
    expect(result.entry).toBe(waitingEntry);
    expect(result.aheadCount).toBe(2);
    expect(result.estimatedWaitSeconds).toBe(2 * openQueue.avg_service_seconds);
    expect(mockQueueNotificationService.notifyBookingCreated).toHaveBeenCalledWith(
      waitingEntry,
      expect.objectContaining({ organizationId: openQueue.organization_id }),
      expect.anything(),
      expect.anything()
    );
  });

  it('formats the ticket display using the queue prefix', async () => {
    mockFindQueueById.mockResolvedValue(openQueue); // prefix = 'A'
    mockFindActiveByUser.mockResolvedValue(null);
    mockFindActiveByLineUser.mockResolvedValue(null);
    mockIncrementCounter.mockResolvedValue({ ticketNumber: 7, businessDate: '2026-07-16' });
    mockCreateEntry.mockResolvedValue({ ...waitingEntry, ticket_code: 'A007' });
    mockGetWaitingPosition.mockResolvedValue(0);
    mockTx();

    await queueService.joinQueue({ queueId: QUEUE_ID, userId: USER_ID });

    expect(mockCreateEntry).toHaveBeenCalledWith(
      expect.objectContaining({ ticketCode: 'A007', ticketNumber: 7 }),
      expect.anything()
    );
  });

  it('returns isExisting=true when caller already has an active ticket', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockFindActiveByUser.mockResolvedValue(waitingEntry);
    mockGetWaitingPosition.mockResolvedValue(1);

    const result = await queueService.joinQueue({
      queueId: QUEUE_ID,
      userId: USER_ID,
    });

    expect(result.isExisting).toBe(true);
    expect(result.entry).toBe(waitingEntry);
    expect(mockWithTransaction).not.toHaveBeenCalled();
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it('rechecks the active ticket after locking the queue to make concurrent joins idempotent', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockFindActiveByUser.mockResolvedValueOnce(null).mockResolvedValueOnce(waitingEntry);
    mockGetWaitingPosition.mockResolvedValue(1);
    mockTx();

    const result = await queueService.joinQueue({
      queueId: QUEUE_ID,
      userId: USER_ID,
    });

    expect(result).toMatchObject({
      entry: waitingEntry,
      aheadCount: 2,
      estimatedWaitSeconds: 2 * openQueue.avg_service_seconds,
      isExisting: true,
    });
    expect(mockFindActiveByUser).toHaveBeenNthCalledWith(2, USER_ID, QUEUE_ID, expect.anything());
    expect(mockIncrementCounter).not.toHaveBeenCalled();
    expect(mockCreateEntry).not.toHaveBeenCalled();
    expect(mockQueueNotificationService.notifyBookingCreated).not.toHaveBeenCalled();
    expect(publicReadModelCache.invalidateQueue).not.toHaveBeenCalled();
  });

  it('throws 404 when the queue does not exist', async () => {
    mockFindQueueById.mockResolvedValue(null);

    await expect(
      queueService.joinQueue({ queueId: QUEUE_ID, userId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when the queue is not open', async () => {
    mockFindQueueById.mockResolvedValue({ ...openQueue, status: 'paused' });
    mockFindActiveByUser.mockResolvedValue(null);
    mockFindActiveByLineUser.mockResolvedValue(null);

    await expect(
      queueService.joinQueue({ queueId: QUEUE_ID, userId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 when the queue is at full capacity', async () => {
    const fullQueue: QueueRow = { ...openQueue, max_capacity: 5 };
    mockFindQueueById.mockResolvedValue(fullQueue);
    mockLockQueueById.mockResolvedValue(fullQueue);
    mockFindActiveByUser.mockResolvedValue(null);
    mockFindActiveByLineUser.mockResolvedValue(null);
    mockCountWaiting.mockResolvedValue(5);
    mockTx();

    await expect(
      queueService.joinQueue({ queueId: QUEUE_ID, userId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── getQueueStatus ────────────────────────────────────────────────────────────

describe('queueService.getQueueStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns queue, waitingCount and estimatedWaitSeconds', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockCountWaiting.mockResolvedValue(4);

    const result = await queueService.getQueueStatus(QUEUE_ID);

    expect(result.queue).toBe(openQueue);
    expect(result.waitingCount).toBe(4);
    expect(result.estimatedWaitSeconds).toBe(4 * openQueue.avg_service_seconds);
    expect(publicReadModelCache.getQueueSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: openQueue.organization_id,
        branchId: BRANCH_ID,
        queueId: QUEUE_ID,
      })
    );
  });

  it('throws 404 when the queue does not exist', async () => {
    mockFindQueueById.mockResolvedValue(null);

    await expect(queueService.getQueueStatus(QUEUE_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getMyTickets ──────────────────────────────────────────────────────────────

describe('queueService.getMyTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntryIdsAhead.mockResolvedValue([]);
    mockFindOrdersByQueueEntries.mockResolvedValue(new Map());
  });

  it('returns an annotated array of active tickets', async () => {
    const order = { id: 'order-1', order_number: 'A012', items: [] };
    mockFindAllActiveForActor.mockResolvedValue([waitingEntry]);
    mockGetWaitingPosition.mockResolvedValue(2);
    mockFindQueueById.mockResolvedValue(openQueue);
    mockFindOrdersByQueueEntries.mockResolvedValue(new Map([[waitingEntry.id, order as never]]));

    const results = await queueService.getMyTickets({ userId: USER_ID });

    expect(results).toHaveLength(1);
    expect(results[0].entry).toBe(waitingEntry);
    expect(results[0].order).toMatchObject({ order_number: 'A012' });
    expect(results[0].aheadCount).toBe(2);
    expect(results[0].estimatedWaitSeconds).toBe(2 * openQueue.avg_service_seconds);
  });

  it('returns an empty array when there are no active tickets', async () => {
    mockFindAllActiveForActor.mockResolvedValue([]);

    const results = await queueService.getMyTickets({ userId: USER_ID });

    expect(results).toEqual([]);
  });
});

describe('queueService.getTicketStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a customer who does not own the requested ticket', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);

    await expect(
      queueService.getTicketStatus(waitingEntry.id, 'different-user', 'different-line-user')
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── cancelTicket ──────────────────────────────────────────────────────────────

describe('queueService.cancelTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLockQueueById.mockResolvedValue(openQueue);
  });

  it('cancels a waiting ticket the actor owns', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);
    mockFindQueueById.mockResolvedValue(openQueue);
    mockMarkCancelled.mockResolvedValue({ ...waitingEntry, status: 'cancelled' });
    mockTx();

    await queueService.cancelTicket({ entryId: ENTRY_ID, actorUserId: USER_ID });

    expect(mockMarkCancelled).toHaveBeenCalledWith(ENTRY_ID, expect.anything());
  });

  it('allows cancellation by matching lineUserId', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);
    mockFindQueueById.mockResolvedValue(openQueue);
    mockMarkCancelled.mockResolvedValue({ ...waitingEntry, status: 'cancelled' });
    mockTx();

    await queueService.cancelTicket({ entryId: ENTRY_ID, actorLineUserId: LINE_USER_ID });

    expect(mockMarkCancelled).toHaveBeenCalledWith(ENTRY_ID, expect.anything());
  });

  it('automatically refunds collected payment for an ordered ticket', async () => {
    const orderedEntry = { ...waitingEntry, order_id: 'order-1' };
    mockFindEntryById.mockResolvedValue(orderedEntry);
    mockFindQueueById.mockResolvedValue(openQueue);
    mockMarkCancelled.mockResolvedValue({ ...orderedEntry, status: 'cancelled' });
    mockTx();

    await queueService.cancelTicket({ entryId: ENTRY_ID, actorUserId: USER_ID });

    expect(paymentsService.refundOrderOnCancellationInClient).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        organizationId: openQueue.organization_id,
        actorId: USER_ID,
      })
    );
  });

  it('throws 404 when the ticket does not exist', async () => {
    mockFindEntryById.mockResolvedValue(null);

    await expect(
      queueService.cancelTicket({ entryId: ENTRY_ID, actorUserId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when the actor does not own the ticket', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);

    await expect(
      queueService.cancelTicket({
        entryId: ENTRY_ID,
        actorUserId: 'other-user',
        actorLineUserId: 'other-line',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 409 when the ticket is already completed', async () => {
    mockFindEntryById.mockResolvedValue({ ...waitingEntry, status: 'completed' });

    await expect(
      queueService.cancelTicket({ entryId: ENTRY_ID, actorUserId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('queueService automatic advancement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindQueueById.mockResolvedValue(openQueue);
    mockLockQueueById.mockResolvedValue(openQueue);
    mockFindByQueueAndStatus.mockResolvedValue(null);
    mockArchiveToHistory.mockResolvedValue(undefined);
    mockTx();
  });

  it('calls the next waiting customer when the serving ticket completes', async () => {
    const serving = { ...waitingEntry, status: 'serving', order_id: null };
    const served = { ...serving, status: 'served', served_at: new Date() };
    const next = { ...waitingEntry, id: 'entry-next', ticket_code: 'A007' };
    const called = { ...next, status: 'called', called_at: new Date() };
    mockFindEntryById.mockResolvedValue(serving);
    mockMarkServed.mockResolvedValue(served);
    mockListWaiting.mockResolvedValue([next]);
    mockMarkCalled.mockResolvedValue(called);

    const result = await queueService.completeTicket({
      entryId: ENTRY_ID,
      actorUserId: USER_ID,
      actorOrganizationId: openQueue.organization_id,
    });

    expect(result.status).toBe('served');
    expect(mockMarkCalled).toHaveBeenCalledWith(next.id, expect.anything());
    expect(mockQueueNotificationService.notifyTicketCalled).toHaveBeenCalled();
  });

  it('does not call another customer when one is already called', async () => {
    const serving = { ...waitingEntry, status: 'serving', order_id: null };
    mockFindEntryById.mockResolvedValue(serving);
    mockMarkServed.mockResolvedValue({ ...serving, status: 'served' });
    mockFindByQueueAndStatus.mockResolvedValue({
      ...waitingEntry,
      id: 'already-called',
      status: 'called',
    });

    await queueService.completeTicket({
      entryId: ENTRY_ID,
      actorUserId: USER_ID,
      actorOrganizationId: openQueue.organization_id,
    });

    expect(mockMarkCalled).not.toHaveBeenCalled();
  });

  it('moves a called customer behind current waiters and calls the next one', async () => {
    const calledEntry = { ...waitingEntry, status: 'called' };
    const next = { ...waitingEntry, id: 'entry-next', ticket_code: 'A007' };
    const deferred = { ...calledEntry, status: 'waiting', called_at: null };
    mockFindEntryById.mockResolvedValue(calledEntry);
    mockListWaiting.mockResolvedValueOnce([next]).mockResolvedValueOnce([next, deferred]);
    mockDeferCalledBySlots.mockResolvedValue(deferred);
    mockMarkCalled.mockResolvedValue({ ...next, status: 'called' });

    const result = await queueService.deferCalledTicket({
      entryId: ENTRY_ID,
      actorUserId: USER_ID,
      actorOrganizationId: openQueue.organization_id,
    });

    expect(result.status).toBe('waiting');
    expect(mockDeferCalledBySlots).toHaveBeenCalledWith(ENTRY_ID, QUEUE_ID, 3, expect.anything());
    expect(mockMarkCalled).toHaveBeenCalledWith(next.id, expect.anything());
    expect(mockArchiveToHistory).toHaveBeenCalledWith(
      deferred,
      'called',
      'waiting',
      'staff_deferred_late_arrival',
      expect.anything(),
      USER_ID
    );
  });

  it('cancels the ticket on the third recorded absence', async () => {
    const calledEntry = {
      ...waitingEntry,
      status: 'called',
      absence_count: 2,
    };
    const noShow = {
      ...calledEntry,
      status: 'no_show',
      absence_count: 3,
      no_show_at: new Date(),
    };
    mockFindEntryById.mockResolvedValue(calledEntry);
    mockMarkNoShow.mockResolvedValue(noShow);
    mockListWaiting.mockResolvedValue([]);

    const result = await queueService.deferCalledTicket({
      entryId: ENTRY_ID,
      actorUserId: USER_ID,
      actorOrganizationId: openQueue.organization_id,
    });

    expect(result.status).toBe('no_show');
    expect(mockMarkNoShow).toHaveBeenCalledWith(ENTRY_ID, expect.anything(), true);
    expect(mockDeferCalledBySlots).not.toHaveBeenCalled();
    expect(mockQueueNotificationService.notifyTicketNoShow).toHaveBeenCalled();
  });
});

// ── skipTicket ────────────────────────────────────────────────────────────────

describe('queueService.skipTicket', () => {
  beforeEach(() => jest.clearAllMocks());

  const deprioritisedEntry: QueueEntryRow = {
    ...waitingEntry,
    priority: 1,
  };

  it('deprioritises the ticket and returns updated position', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);
    mockFindQueueById.mockResolvedValue(openQueue);
    mockDeprioritize.mockResolvedValue(deprioritisedEntry);
    mockGetWaitingPosition.mockResolvedValue(3);

    const result = await queueService.skipTicket({ entryId: ENTRY_ID, actorUserId: USER_ID });

    expect(result.skipCount).toBe(0);
    expect(result.aheadCount).toBe(3);
    expect(result.entry).toBe(deprioritisedEntry);
    expect(mockDeprioritize).toHaveBeenCalledWith(ENTRY_ID);
  });

  it('throws 404 when the ticket does not exist', async () => {
    mockFindEntryById.mockResolvedValue(null);

    await expect(
      queueService.skipTicket({ entryId: ENTRY_ID, actorUserId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when the queue does not allow skipping', async () => {
    mockFindEntryById.mockResolvedValue(waitingEntry);
    mockFindQueueById.mockResolvedValue({ ...openQueue, allow_skip: false });

    await expect(
      queueService.skipTicket({ entryId: ENTRY_ID, actorUserId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 when the ticket is not in waiting status', async () => {
    mockFindEntryById.mockResolvedValue({ ...waitingEntry, status: 'called' });
    mockFindQueueById.mockResolvedValue(openQueue);

    await expect(
      queueService.skipTicket({ entryId: ENTRY_ID, actorUserId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows skip and records penalty when skip limit has been reached', async () => {
    const atLimitEntry = { ...waitingEntry, priority: 2, user_id: USER_ID }; // equals max_skips_before_penalty (2)
    const deprioritisedAtLimit = { ...atLimitEntry, priority: 3 };
    mockFindEntryById.mockResolvedValue(atLimitEntry);
    mockFindQueueById.mockResolvedValue(openQueue); // max_skips_before_penalty = 2
    mockDeprioritize.mockResolvedValue(deprioritisedAtLimit);
    mockGetWaitingPosition.mockResolvedValue(5);
    mockOnSkipExhausted.mockResolvedValue(undefined);

    // P20: skip is allowed even at limit — no longer throws 409
    const result = await queueService.skipTicket({ entryId: ENTRY_ID, actorUserId: USER_ID });

    expect(result.skipCount).toBe(0);
    expect(mockOnSkipExhausted).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, queueId: QUEUE_ID })
    );
  });
});
