import { pool } from '../../../db/client';
import { ordersRepository } from '../../../db/repositories/orders.repository';

jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn() },
}));

interface QueryMock {
  mockResolvedValue(value: unknown): void;
  mock: { calls: unknown[][] };
}

const mockQuery = pool.query as unknown as QueryMock;

describe('ordersRepository.findByQueueEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins the authenticated customer email into the staff order result', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'order-1',
          customer_email: 'customer@example.com',
          items_json: [],
        },
      ],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const result = await ordersRepository.findByQueueEntry('entry-1');

    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('LEFT JOIN users u ON u.id = o.customer_user_id');
    expect(sql).toContain('u.email AS customer_email');
    expect(result?.customer_email).toBe('customer@example.com');
  });
});
