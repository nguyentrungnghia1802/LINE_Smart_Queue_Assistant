jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../../db/client';
import { ordersRepository } from '../../../db/repositories/orders.repository';

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

function setupDashboardQueries(): void {
  mockQuery
    .mockResolvedValueOnce({
      rows: [
        {
          total: '10',
          completed: '6',
          cancelled: '2',
          pending: '2',
          revenue: '1500000',
          average_eta_seconds: '420.4',
        },
      ],
    } as never)
    .mockResolvedValueOnce({
      rows: [{ month: '2026-06', revenue: '500000', orders: '3' }],
    } as never)
    .mockResolvedValueOnce({
      rows: [{ product_name: 'Haircut', total_sold: '5', revenue: '600000' }],
    } as never)
    .mockResolvedValueOnce({ rows: [{ count: '3' }] } as never)
    .mockResolvedValueOnce({ rows: [{ count: '4' }] } as never)
    .mockResolvedValueOnce({
      rows: [
        {
          user_id: 'staff-1',
          display_name: 'Staff A',
          employee_code: 'S001',
          completed_orders: '4',
          revenue: '700000',
        },
      ],
    } as never);
}

describe('ordersRepository.getStats dashboard analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds branch dashboard analytics from completed business data', async () => {
    setupDashboardQueries();

    const stats = await ordersRepository.getStats('org-1', 'branch-1');

    expect(stats).toMatchObject({
      totalRevenue: 1500000,
      totalOrders: 10,
      completedOrders: 6,
      cancelledOrders: 2,
      pendingOrders: 2,
      cancellationRate: 0.2,
      activeQueueEntries: 3,
      averageEtaSeconds: 420,
      totalProducts: 4,
      currentQueueDepth: 3,
    });
    expect(stats.monthlyRevenue).toEqual([{ month: '2026-06', revenue: 500000, orders: 3 }]);
    expect(stats.topProducts).toEqual([
      { product_name: 'Haircut', total_sold: 5, revenue: 600000 },
    ]);
    expect(stats.bestStaff).toEqual({
      user_id: 'staff-1',
      display_name: 'Staff A',
      employee_code: 'S001',
      completed_orders: 4,
      revenue: 700000,
    });
    for (const call of mockQuery.mock.calls) {
      expect(call[1]).toEqual(['org-1', 'branch-1']);
    }
  });
});
