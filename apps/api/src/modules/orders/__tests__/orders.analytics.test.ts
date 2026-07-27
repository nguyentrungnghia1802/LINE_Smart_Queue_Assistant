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
      rows: [{ month: '2026-06', revenue: '5000', orders: '8' }],
    } as never)
    .mockResolvedValueOnce({
      rows: [{ product_name: 'Haircut', total_sold: '40', revenue: '20000' }],
    } as never)
    .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never)
    .mockResolvedValueOnce({ rows: [{ count: '12' }] } as never)
    .mockResolvedValueOnce({
      rows: [
        {
          user_id: 'staff-1',
          display_name: 'Alice',
          employee_code: 'S001',
          completed_orders: '12',
          revenue: '25000',
        },
      ],
    } as never);
}

describe('ordersRepository.getStats', () => {
  beforeEach(() => void jest.clearAllMocks());

  it('returns numbers for all dashboard metrics', async () => {
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
    expect(typeof stats.monthlyRevenue[0]?.revenue).toBe('number');
    expect(typeof stats.monthlyRevenue[0]?.orders).toBe('number');
    expect(typeof stats.topProducts[0]?.total_sold).toBe('number');
    expect(typeof stats.bestStaff?.revenue).toBe('number');
  });

  it('calculates cancellation rate correctly', async () => {
    setupHappyPath();
    const stats = await ordersRepository.getStats('org-1');
    expect(stats.cancellationRate).toBeCloseTo(0.1);
  });

  it('returns zero for cancellation rate when there are no orders', async () => {
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

  it('uses no more than six database queries', async () => {
    setupHappyPath();
    await ordersRepository.getStats('org-1');
    expect(mockQuery.mock.calls.length).toBeLessThanOrEqual(6);
  });
});
