/**
 * Unit tests for batchWorkloadForEntries and the findByQueueEntry N+1 fix.
 *
 * Strategy: mock the pool at the module level so no live DB is required.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock pool before importing the repository
jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../../db/client';
import {
  batchWorkloadForEntries,
  calculateWorkloadForEntries,
  ordersRepository,
} from '../../../db/repositories/orders.repository';

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('calculateWorkloadForEntries', () => {
  it('returns 0 for empty input without hitting the DB', async () => {
    const result = await calculateWorkloadForEntries([]);
    expect(result).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('queries the DB and returns the total minutes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total_minutes: '45.5' }] } as never);
    const result = await calculateWorkloadForEntries(['entry-1', 'entry-2']);
    expect(result).toBe(45.5);
  });

  it('returns 0 when DB returns null total_minutes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ total_minutes: null }] } as never);
    const result = await calculateWorkloadForEntries(['entry-1']);
    expect(result).toBe(0);
  });
});

describe('batchWorkloadForEntries', () => {
  it('returns an empty Map for empty input without hitting the DB', async () => {
    const result = await batchWorkloadForEntries([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns a Map keyed by queue_entry_id with numeric workload', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { queue_entry_id: 'entry-1', total_minutes: '30' },
        { queue_entry_id: 'entry-2', total_minutes: '60' },
      ],
    } as never);

    const result = await batchWorkloadForEntries(['entry-1', 'entry-2', 'entry-3']);

    expect(result.get('entry-1')).toBe(30);
    expect(result.get('entry-2')).toBe(60);
    // entry-3 had no orders → not in result Map
    expect(result.get('entry-3')).toBeUndefined();
  });

  it('uses a single DB query regardless of input size', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    await batchWorkloadForEntries(['a', 'b', 'c', 'd', 'e']);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('ordersRepository.findByQueueEntry', () => {
  it('returns null when no row is found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const result = await ordersRepository.findByQueueEntry('missing-entry');
    expect(result).toBeNull();
    // Must only make ONE query (no N+1 second findById call)
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('makes exactly ONE query (no N+1)', async () => {
    const fakeRow = {
      id: 'order-1',
      organization_id: 'org-1',
      queue_entry_id: 'entry-1',
      order_number: 'A001',
      customer_name: 'Test',
      customer_user_id: null,
      customer_phone: null,
      status: 'pending',
      subtotal: '100',
      payment_status: 'unpaid',
      payment_code: null,
      notes: null,
      created_at: new Date(),
      updated_at: new Date(),
      items_json: '[]',
    };
    mockQuery.mockResolvedValueOnce({ rows: [fakeRow] } as never);

    await ordersRepository.findByQueueEntry('entry-1');

    // Before the fix this was 2 queries (SELECT * then findById).
    // After the fix it is exactly 1.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
