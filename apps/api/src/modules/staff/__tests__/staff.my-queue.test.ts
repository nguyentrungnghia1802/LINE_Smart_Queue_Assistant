/**
 * Unit tests for the bounded, batch-backed Staff queue overview.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ordersRepository } from '../../../db/repositories/orders.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { staffService } from '../staff.service';

jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/orders.repository');

const mockFindActiveByBranches = queuesRepository.findActiveByBranches as jest.MockedFunction<
  typeof queuesRepository.findActiveByBranches
>;
const mockListWaiting = queueEntriesRepository.listWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.listWaiting
>;
const mockCountLiveByQueueIds = queueEntriesRepository.countLiveByQueueIds as jest.MockedFunction<
  typeof queueEntriesRepository.countLiveByQueueIds
>;
const mockFindByQueueAndStatus = queueEntriesRepository.findByQueueAndStatus as jest.MockedFunction<
  typeof queueEntriesRepository.findByQueueAndStatus
>;
const mockFindByQueueEntries = ordersRepository.findByQueueEntries as jest.MockedFunction<
  typeof ordersRepository.findByQueueEntries
>;

const ORG_ID = 'org-001';
const BRANCH_ID = 'branch-001';
const QUEUE_ID = 'queue-001';

const queueRow = {
  id: QUEUE_ID,
  organization_id: ORG_ID,
  branch_id: BRANCH_ID,
  name: 'Counter A',
  description: null,
  status: 'open',
  queue_type: 'walk_in',
  prefix: 'A',
  max_capacity: null,
  daily_ticket_counter: 5,
  last_counter_reset_at: new Date(),
  avg_service_seconds: 300,
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

function makeEntry(id: string, ticket: string, status: string): QueueEntryRow {
  return {
    id,
    queue_id: QUEUE_ID,
    user_id: null,
    order_id: null,
    line_user_id: null,
    ticket_number: Number.parseInt(ticket.replace('A-', '')),
    ticket_code: ticket,
    status,
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
}

describe('staffService.getMyQueueOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountLiveByQueueIds.mockResolvedValue({});
    mockListWaiting.mockResolvedValue([]);
    mockFindByQueueAndStatus.mockResolvedValue(null);
    mockFindByQueueEntries.mockResolvedValue(new Map());
  });

  it('returns null when the actor has no active queue', async () => {
    mockFindActiveByBranches.mockResolvedValue([]);

    await expect(staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID])).resolves.toBeNull();
    expect(mockCountLiveByQueueIds).not.toHaveBeenCalled();
  });

  it('returns waiting totals and a bounded preview', async () => {
    const entries = [makeEntry('e001', 'A-001', 'waiting'), makeEntry('e002', 'A-002', 'waiting')];
    mockFindActiveByBranches.mockResolvedValue([queueRow]);
    mockCountLiveByQueueIds.mockResolvedValue({
      [QUEUE_ID]: { waitingCount: 12, calledCount: 0, servingCount: 0 },
    });
    mockListWaiting.mockResolvedValue(entries);

    const result = await staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID]);

    expect(mockListWaiting).toHaveBeenCalledWith(QUEUE_ID, undefined, 8);
    expect(result?.waitingCount).toBe(12);
    expect(result?.totalActiveCount).toBe(12);
    expect(result?.waitingEntriesWithOrders).toHaveLength(2);
  });

  it('loads all preview orders with one batch repository call', async () => {
    const entry = makeEntry('e003', 'A-003', 'waiting');
    const mockOrder = {
      id: 'order-001',
      organization_id: ORG_ID,
      branch_id: BRANCH_ID,
      queue_id: QUEUE_ID,
      queue_entry_id: entry.id,
      order_number: 'A003',
      customer_name: 'Test Customer',
      customer_user_id: null,
      customer_phone: null,
      status: 'pending',
      subtotal: '120000',
      payment_status: 'unpaid',
      payment_code: null,
      notes: null,
      organization_name_snapshot: 'Test Organization',
      branch_name_snapshot: 'Test Branch',
      queue_name_snapshot: 'Test Queue',
      fulfilled_by_user_id: null,
      fulfilled_by_name: null,
      fulfilled_by_employee_code: null,
      fulfilled_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      items: [],
    };
    mockFindActiveByBranches.mockResolvedValue([queueRow]);
    mockCountLiveByQueueIds.mockResolvedValue({
      [QUEUE_ID]: { waitingCount: 1, calledCount: 0, servingCount: 0 },
    });
    mockListWaiting.mockResolvedValue([entry]);
    mockFindByQueueEntries.mockResolvedValue(new Map([[entry.id, mockOrder]]));

    const result = await staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID]);

    expect(mockFindByQueueEntries).toHaveBeenCalledTimes(1);
    expect(mockFindByQueueEntries).toHaveBeenCalledWith([entry.id]);
    expect(mockFindActiveByBranches).toHaveBeenCalledTimes(1);
    expect(mockCountLiveByQueueIds).toHaveBeenCalledTimes(1);
    expect(mockListWaiting).toHaveBeenCalledTimes(1);
    expect(mockFindByQueueAndStatus).toHaveBeenCalledTimes(2);
    expect(result?.waitingEntriesWithOrders[0]?.order).toEqual(mockOrder);
  });

  it('keeps the combined waiting/called/serving preview bounded to eight entries', async () => {
    const calledEntry = makeEntry('e006', 'A-006', 'called');
    const servingEntry = makeEntry('e007', 'A-007', 'serving');
    const waitingEntries = Array.from({ length: 8 }, (_, index) =>
      makeEntry(`e${index + 10}`, `A-${index + 10}`, 'waiting')
    );
    mockFindActiveByBranches.mockResolvedValue([queueRow]);
    mockCountLiveByQueueIds.mockResolvedValue({
      [QUEUE_ID]: { waitingCount: 12, calledCount: 1, servingCount: 1 },
    });
    mockListWaiting.mockResolvedValue(waitingEntries);
    mockFindByQueueAndStatus.mockResolvedValueOnce(calledEntry).mockResolvedValueOnce(servingEntry);

    const result = await staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID]);

    expect(result?.waitingEntriesWithOrders).toHaveLength(6);
    expect(result?.calledEntryWithOrder?.ticket_code).toBe('A-006');
    expect(result?.servingEntryWithOrder?.ticket_code).toBe('A-007');
    expect(mockFindByQueueEntries).toHaveBeenCalledWith([
      ...waitingEntries.slice(0, 6).map((entry) => entry.id),
      calledEntry.id,
      servingEntry.id,
    ]);
  });

  it('selects the first queue with live entries without loading every queue overview', async () => {
    const secondQueue = { ...queueRow, id: 'queue-002', name: 'Counter B' };
    const waitingEntry = { ...makeEntry('e008', 'A-008', 'waiting'), queue_id: secondQueue.id };
    mockFindActiveByBranches.mockResolvedValue([queueRow, secondQueue]);
    mockCountLiveByQueueIds.mockResolvedValue({
      [secondQueue.id]: { waitingCount: 1, calledCount: 0, servingCount: 0 },
    });
    mockListWaiting.mockResolvedValue([waitingEntry]);

    const result = await staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID]);

    expect(result?.queueId).toBe(secondQueue.id);
    expect(mockCountLiveByQueueIds).toHaveBeenCalledWith([QUEUE_ID, secondQueue.id]);
    expect(mockListWaiting).toHaveBeenCalledTimes(1);
    expect(mockListWaiting).toHaveBeenCalledWith(secondQueue.id, undefined, 8);
  });

  it('returns only the queue assigned to the Staff actor', async () => {
    const secondQueue = { ...queueRow, id: 'queue-002', name: 'Counter B' };
    mockFindActiveByBranches.mockResolvedValue([queueRow, secondQueue]);
    mockCountLiveByQueueIds.mockResolvedValue({
      [secondQueue.id]: { waitingCount: 0, calledCount: 0, servingCount: 0 },
    });

    const result = await staffService.getMyQueueOverview(
      ORG_ID,
      [BRANCH_ID],
      undefined,
      secondQueue.id
    );

    expect(result?.queueId).toBe(secondQueue.id);
    expect(result?.availableQueues).toEqual([{ id: secondQueue.id, name: secondQueue.name }]);
    expect(mockCountLiveByQueueIds).toHaveBeenCalledWith([secondQueue.id]);
  });

  it('rejects a requested queue outside the actor branch scope', async () => {
    mockFindActiveByBranches.mockResolvedValue([queueRow]);

    await expect(
      staffService.getMyQueueOverview(ORG_ID, [BRANCH_ID], 'queue-outside')
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockListWaiting).not.toHaveBeenCalled();
  });
});
