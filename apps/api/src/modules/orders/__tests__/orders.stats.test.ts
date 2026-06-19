jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../../db/client';
import { ordersRepository } from '../../../db/repositories/orders.repository';

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('ordersRepository.getStats dashboard analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds manager dashboard analytics from database query results', async () => {
    // New call order after performance optimization:
    // 1. summaryEta CTE (merged summary + average_eta_seconds)
    // 2. daily revenue
    // 3. top products
    // 4. queueAndProducts[0] — queue depth (inner Promise.all)
    // 5. queueAndProducts[1] — product count (inner Promise.all)
    // 6. recentOrders
    // 7. recentQueueActivities
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
        rows: [{ date: '2026-06-18', revenue: '500000', orders: '3' }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ product_name: 'Haircut', total_sold: '5', revenue: '600000' }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ count: '3' }] } as never) // queue depth
      .mockResolvedValueOnce({ rows: [{ count: '4' }] } as never) // product count
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'order-1',
            order_number: 'A001',
            customer_name: 'An',
            status: 'pending',
            subtotal: '120000',
            payment_status: 'unpaid',
            created_at: new Date('2026-06-18T08:00:00.000Z'),
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
            ticket_code: 'A001',
            status: 'waiting',
            updated_at: new Date('2026-06-18T08:01:00.000Z'),
            order_number: 'A001',
            customer_name: 'An',
          },
        ],
      } as never);

    const stats = await ordersRepository.getStats('org-1');

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
    expect(stats.topProducts).toEqual([
      { product_name: 'Haircut', total_sold: 5, revenue: 600000 },
    ]);
    expect(stats.recentOrders[0]).toMatchObject({
      id: 'order-1',
      subtotal: 120000,
      item_count: 2,
    });
    expect(stats.recentQueueActivities[0]).toMatchObject({
      entry_id: 'entry-1',
      ticket_code: 'A001',
      status: 'waiting',
    });
  });
});
