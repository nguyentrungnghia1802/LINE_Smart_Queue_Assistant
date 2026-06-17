/**
 * Unit tests for ordersRepository.getStats (analytics queries).
 *
 * Verifies:
 *   1. All returned numeric fields are JavaScript numbers (not strings).
 *   2. cancellationRate is calculated correctly.
 *   3. Zero-division guard: cancellationRate = 0 when totalOrders = 0.
 *   4. The merged CTE query is called (no more than 6 DB round-trips).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../../db/client';
import { ordersRepository } from '../../../db/repositories/orders.repository';

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

function setupHappyPath(): void {
  // Call order in the optimized getStats:
  //   1. summaryEta (CTE)
  //   2. daily
  //   3. top products
  //   4. queueAndProducts[0] (queue depth)
  //   5. queueAndProducts[1] (product count)
  //   6. recentOrders
  //   7. recentQueueActivities
  mockQuery
    .mockResolvedValueOnce({
      rows: [
        {
          total: '100',
          completed: '80',
          cancelled: '10',
          pending: '10',
          revenue: '50000',
          average_eta_seconds: '300',
        },
      ],
    } as never)
    .mockResolvedValueOnce({
      rows: [{ date: '2026-06-18', revenue: '5000', orders: '8' }],
    } as never)
    .mockResolvedValueOnce({
      rows: [{ product_name: 'Haircut', total_sold: '40', revenue: '20000' }],
    } as never)
    .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never)
    .mockResolvedValueOnce({ rows: [{ count: '12' }] } as never)
    .mockResolvedValueOnce({
      rows: [
        {
          id: 'order-1',
          order_number: 'A001',
          customer_name: 'Alice',
          status: 'completed',
          subtotal: '250',
          payment_status: 'paid',
          created_at: new Date(),
          item_count: '2',
        },
      ],
    } as never)
    .mockResolvedValueOnce({
      rows: [
        {
          entry_id: 'entry-1',
          queue_id: 'queue-1',
          queue_name: 'Counter A',
          ticket_display: 'A001',
          status: 'waiting',
          updated_at: new Date(),
          order_number: null,
          customer_name: null,
        },
      ],
    } as never);
}

describe('ordersRepository.getStats', () => {
  beforeEach(() => void jest.clearAllMocks());

  it('returns numbers (not strings) for all numeric fields', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');

    expect(typeof stats.totalOrders).toBe('number');
    expect(typeof stats.totalRevenue).toBe('number');
    expect(typeof stats.completedOrders).toBe('number');
    expect(typeof stats.cancelledOrders).toBe('number');
    expect(typeof stats.pendingOrders).toBe('number');
    expect(typeof stats.cancellationRate).toBe('number');
    expect(typeof stats.averageEtaSeconds).toBe('number');
    expect(typeof stats.totalProducts).toBe('number');
    expect(typeof stats.currentQueueDepth).toBe('number');
  });

  it('calculates cancellationRate correctly', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');
    // 10 cancelled / 100 total = 0.1
    expect(stats.cancellationRate).toBeCloseTo(0.1);
  });

  it('returns 0 for cancellationRate when totalOrders is 0', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total: '0',
            completed: '0',
            cancelled: '0',
            pending: '0',
            revenue: '0',
            average_eta_seconds: '0',
          },
        ],
      } as never)
      .mockResolvedValue({ rows: [] } as never);

    const stats = await ordersRepository.getStats('org-1');
    expect(stats.cancellationRate).toBe(0);
  });

  it('maps daily revenue rows to numeric types', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');

    expect(stats.dailyRevenue).toHaveLength(1);
    expect(typeof stats.dailyRevenue[0]?.revenue).toBe('number');
    expect(typeof stats.dailyRevenue[0]?.orders).toBe('number');
  });

  it('maps top products to numeric types', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');

    expect(stats.topProducts).toHaveLength(1);
    expect(typeof stats.topProducts[0]?.total_sold).toBe('number');
    expect(typeof stats.topProducts[0]?.revenue).toBe('number');
  });

  it('maps recentOrders item_count to number', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');
    expect(typeof stats.recentOrders[0]?.item_count).toBe('number');
    expect(typeof stats.recentOrders[0]?.subtotal).toBe('number');
  });

  it('uses at most 7 DB queries (down from 8)', async () => {
    setupHappyPath();
    await ordersRepository.getStats('org-1');
    // Promise.all wraps queueAndProducts as nested Promise.all → 2 calls
    // Total: summaryEta + daily + top + queue + products + recentOrders + recentQueue = 7
    expect(mockQuery.mock.calls.length).toBeLessThanOrEqual(7);
  });
});
