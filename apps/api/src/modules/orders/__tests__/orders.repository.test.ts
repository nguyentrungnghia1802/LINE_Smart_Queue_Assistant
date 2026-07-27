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

  it('joins the verified LINE display name into the staff order result', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'order-1',
          customer_line_display_name: 'LINE 山田',
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
    expect(sql).toContain('LEFT JOIN line_accounts la ON la.user_id = o.customer_user_id');
    expect(sql).toContain('la.display_name AS customer_line_display_name');
    expect(sql).toContain("'prepaid_amount', oi.prepaid_amount");
    expect(sql).toContain("'refunded_amount', oi.refunded_amount");
    expect(sql).toContain("'requires_prepayment_snapshot', oi.requires_prepayment_snapshot");
    expect(result?.customer_line_display_name).toBe('LINE 山田');
  });

  it('finds only an active booking group for the same LINE user and branch', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ booking_group_id: 'group-active' }] }),
    } as never;

    await expect(
      ordersRepository.findActiveBookingGroupForLineUser('org-1', 'branch-1', 'U001', client)
    ).resolves.toBe('group-active');

    expect(String((client as { query: jest.Mock }).query.mock.calls[0]?.[0])).toContain(
      'pg_advisory_xact_lock'
    );
    const sql = String((client as { query: jest.Mock }).query.mock.calls[1]?.[0]);
    expect(sql).toContain("o.status IN ('pending','processing')");
    expect(sql).toContain("qe.status IN ('waiting','called','serving')");
    expect((client as { query: jest.Mock }).query.mock.calls[1]?.[1]).toEqual([
      'org-1',
      'branch-1',
      'U001',
    ]);
  });

  it('stores the staff snapshot when completing an order', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'order-1', status: 'completed' }] }),
    } as never;

    await ordersRepository.completeWithFulfillment('order-1', 'staff-1', client);

    const sql = String((client as { query: jest.Mock }).query.mock.calls[0]?.[0]);
    expect(sql).toContain('fulfilled_by_user_id = actor.id');
    expect(sql).toContain('fulfilled_by_employee_code = actor.employee_code');
    expect(sql).toContain('fulfilled_at = NOW()');
  });
});
