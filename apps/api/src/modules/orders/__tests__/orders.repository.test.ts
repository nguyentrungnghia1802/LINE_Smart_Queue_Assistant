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

  it('returns stable database order numbers keyed by queue entry in one query', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'order-1',
          queue_entry_id: 'entry-1',
          order_number: 'A012',
          items_json: [{ id: 'item-1' }],
        },
      ],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const result = await ordersRepository.findByQueueEntries(['entry-1']);

    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('WHERE qe.id = ANY($1::uuid[])');
    expect(result.get('entry-1')).toMatchObject({
      id: 'order-1',
      order_number: 'A012',
      items: [{ id: 'item-1' }],
    });
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

  it('locks and returns one active order for the same LINE user and queue', async () => {
    const active = {
      order_record: { id: 'order-active' },
      queue_entry: { id: 'entry-active', status: 'waiting' },
    };
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [active] }),
    } as never;

    await expect(
      ordersRepository.findActiveOrderForLineUserInQueue(
        'org-1',
        'branch-1',
        'queue-1',
        'U001',
        client
      )
    ).resolves.toEqual({
      order: active.order_record,
      entry: active.queue_entry,
    });

    const query = (client as { query: jest.Mock }).query;
    expect(String(query.mock.calls[0]?.[0])).toContain('pg_advisory_xact_lock');
    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toContain('o.queue_id = $3');
    expect(sql).toContain("o.status IN ('pending','processing')");
    expect(sql).toContain("qe.status IN ('waiting','called','serving')");
    expect(sql).toContain('FOR UPDATE OF o, qe');
  });

  it('recalculates the active order total and payment state from all order items', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'order-1', subtotal: '4500' }] }),
    } as never;

    await ordersRepository.refreshActiveOrder(
      {
        orderId: 'order-1',
        customerName: '山田太郎',
        customerPhone: '0901234567',
        paymentCode: 'payment-2',
      },
      client
    );

    const sql = String((client as { query: jest.Mock }).query.mock.calls[0]?.[0]);
    expect(sql).toContain('COALESCE(SUM(item.subtotal), 0)');
    expect(sql).toContain("item.payment_status <> 'paid'::payment_status");
    expect(sql).toContain('customer_name = $2');
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
