import type { PoolClient } from 'pg';

import {
  InventoryReservationRow,
  inventoryReservationsRepository,
} from '../../../db/repositories/inventory-reservations.repository';

function reservation(status: InventoryReservationRow['status']): InventoryReservationRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organization_id: '22222222-2222-4222-8222-222222222222',
    order_id: '33333333-3333-4333-8333-333333333333',
    product_id: '44444444-4444-4444-8444-444444444444',
    quantity: 2,
    status,
    expires_at: null,
    consumed_at: null,
    released_at: null,
    expired_at: null,
    release_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

describe('inventoryReservationsRepository', () => {
  it('restocks only reservations that transition from reserved', async () => {
    const reserved = reservation('reserved');
    const alreadyReleased = reservation('released');
    alreadyReleased.id = '55555555-5555-4555-8555-555555555555';
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [reserved, alreadyReleased] })
      .mockResolvedValueOnce({ rows: [{ ...reserved, status: 'released' }] })
      .mockResolvedValueOnce({ rows: [{ id: reserved.product_id }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query } as unknown as PoolClient;

    const changed = await inventoryReservationsRepository.transitionOrder(
      { orderId: reserved.order_id, toStatus: 'released', reason: 'test_cancel' },
      client
    );

    expect(changed).toBe(1);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[2][0]).toContain('stock_quantity = stock_quantity +');
  });

  it('rejects reserve when a conditional stock decrement cannot be made', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;

    await expect(
      inventoryReservationsRepository.reserve(
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
          orderId: '33333333-3333-4333-8333-333333333333',
          productId: '44444444-4444-4444-8444-444444444444',
          quantity: 3,
        },
        client
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
