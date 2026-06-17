/**
 * Unit tests for staffService.getMyQueueOverview.
 *
 * Verifies:
 *   1. Returns null when org has no active queues.
 *   2. Returns enriched overview (waiting + called + serving with orders).
 *   3. Orders are fetched for each entry via findByQueueEntry.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ordersRepository } from '../../../db/repositories/orders.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { staffService } from '../staff.service';

jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/orders.repository');

const mockFindActiveByOrg = queuesRepository.findActiveByOrg as jest.MockedFunction<
  typeof queuesRepository.findActiveByOrg
>;
const mockFindById = queuesRepository.findById as jest.MockedFunction<
  typeof queuesRepository.findById
>;
const mockListWaiting = queueEntriesRepository.listWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.listWaiting
>;
const mockFindByQueueAndStatus = queueEntriesRepository.findByQueueAndStatus as jest.MockedFunction<
  typeof queueEntriesRepository.findByQueueAndStatus
>;
const mockFindByQueueEntry = ordersRepository.findByQueueEntry as jest.MockedFunction<
  typeof ordersRepository.findByQueueEntry
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';
const QUEUE_ID = 'queue-001';

const queueRow = {
  id: QUEUE_ID,
  organization_id: ORG_ID,
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

function makeEntry(id: string, ticket: string, status: string) {
  return {
    id,
    queue_id: QUEUE_ID,
    user_id: null,
    line_user_id: null,
    ticket_number: Number.parseInt(ticket.replace('A-', '')),
    ticket_display: ticket,
    status,
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
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('staffService.getMyQueueOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue(queueRow);
    mockFindByQueueEntry.mockResolvedValue(null);
  });

  it('returns null when org has no active queues', async () => {
    mockFindActiveByOrg.mockResolvedValue([]);

    const result = await staffService.getMyQueueOverview(ORG_ID);

    expect(result).toBeNull();
    expect(mockFindActiveByOrg).toHaveBeenCalledWith(ORG_ID);
  });

  it('returns enriched overview with waiting entries', async () => {
    const entry1 = makeEntry('e001', 'A-001', 'waiting');
    const entry2 = makeEntry('e002', 'A-002', 'waiting');

    mockFindActiveByOrg.mockResolvedValue([queueRow]);
    mockListWaiting.mockResolvedValue([entry1, entry2]);
    mockFindByQueueAndStatus.mockResolvedValue(null); // no called/serving

    const result = await staffService.getMyQueueOverview(ORG_ID);
    if (!result) throw new Error('Expected queue overview for active queue');

    expect(result.queueId).toBe(QUEUE_ID);
    expect(result.waitingCount).toBe(2);
    expect(result.waitingEntriesWithOrders).toHaveLength(2);
    expect(result.calledEntryWithOrder).toBeNull();
    expect(result.servingEntryWithOrder).toBeNull();
  });

  it('attaches order to each entry via findByQueueEntry', async () => {
    const entry = makeEntry('e003', 'A-003', 'waiting');
    const mockOrder = {
      id: 'order-001',
      organization_id: ORG_ID,
      queue_entry_id: 'e003',
      order_number: 'A003',
      customer_name: 'Test Customer',
      customer_user_id: null,
      customer_phone: null,
      status: 'pending',
      subtotal: '120000',
      payment_status: 'unpaid',
      payment_code: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
      items: [],
    };

    mockFindActiveByOrg.mockResolvedValue([queueRow]);
    mockListWaiting.mockResolvedValue([entry]);
    mockFindByQueueAndStatus.mockResolvedValue(null);
    mockFindByQueueEntry.mockResolvedValue(mockOrder);

    const result = await staffService.getMyQueueOverview(ORG_ID);
    if (!result) throw new Error('Expected queue overview for active queue');

    expect(mockFindByQueueEntry).toHaveBeenCalledWith('e003');
    expect(result.waitingEntriesWithOrders[0]?.order).toEqual(mockOrder);
  });

  it('includes called and serving entries with orders', async () => {
    const calledEntry = makeEntry('e006', 'A-006', 'called');
    const servingEntry = makeEntry('e007', 'A-007', 'serving');

    mockFindActiveByOrg.mockResolvedValue([queueRow]);
    mockListWaiting.mockResolvedValue([]);
    mockFindByQueueAndStatus
      .mockResolvedValueOnce(calledEntry) // first call: 'called'
      .mockResolvedValueOnce(servingEntry); // second call: 'serving'

    const result = await staffService.getMyQueueOverview(ORG_ID);
    if (!result) throw new Error('Expected queue overview for active queue');
    if (!result.calledEntryWithOrder || !result.servingEntryWithOrder) {
      throw new Error('Expected called and serving entries in queue overview');
    }

    expect(result.calledEntryWithOrder.ticket_display).toBe('A-006');
    expect(result.servingEntryWithOrder.ticket_display).toBe('A-007');
  });
});
