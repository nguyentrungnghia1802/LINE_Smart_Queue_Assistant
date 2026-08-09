/**
 * Unit tests for orders.validator — customer linkage fields.
 *
 * Verifies:
 *   1. Customer name and phone are required and accepted.
 *   2. `customerPhone` is rejected when too long (> 20 chars).
 *   3. Orders without customer contact details are rejected.
 */
import { NUMERIC_LIMITS } from '@line-queue/shared';

import { CreateOrderSchema } from '../orders.validator';

const baseOrder = {
  orgSlug: 'test-salon',
  branchId: '11111111-1111-4111-8111-111111111111',
  queueId: '22222222-2222-4222-8222-222222222222',
  customerName: '山田太郎',
  customerPhone: '0901234567',
  items: [{ productId: '44444444-4444-4444-8444-444444444441', quantity: 1 }],
};

describe('CreateOrderSchema — customer linkage fields', () => {
  it('rejects an order without customer info', () => {
    const result = CreateOrderSchema.safeParse({
      orgSlug: baseOrder.orgSlug,
      items: baseOrder.items,
    });
    expect(result.success).toBe(false);
  });

  it('accepts customerName and customerPhone when provided', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901234567',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerName).toBe('Nguyễn Văn A');
      expect(result.data.customerPhone).toBe('0901234567');
    }
  });

  it('rejects customerPhone longer than 20 characters', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      customerPhone: '090123456789012345678', // 21 chars
    });
    expect(result.success).toBe(false);
  });

  it('rejects orders with no items', () => {
    const result = CreateOrderSchema.safeParse({ ...baseOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized item collection', () => {
    const items = Array.from({ length: NUMERIC_LIMITS.orderLineItems.max + 1 }, (_, index) => ({
      productId: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
      quantity: 1,
    }));
    expect(CreateOrderSchema.safeParse({ ...baseOrder, items }).success).toBe(false);
  });

  it('rejects items with quantity 0', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      items: [{ productId: '44444444-4444-4444-8444-444444444441', quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item quantities and location accuracy above their safe limits', () => {
    expect(
      CreateOrderSchema.safeParse({
        ...baseOrder,
        items: [
          {
            productId: baseOrder.items[0].productId,
            quantity: NUMERIC_LIMITS.orderItemQuantity.max + 1,
          },
        ],
      }).success
    ).toBe(false);
    expect(
      CreateOrderSchema.safeParse({
        ...baseOrder,
        customerLocation: {
          latitude: 35.681236,
          longitude: 139.767125,
          accuracyMeters: NUMERIC_LIMITS.locationAccuracyMeters.max + 1,
        },
      }).success
    ).toBe(false);
  });

  it('rejects items with invalid productId format', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      items: [{ productId: 'not-a-uuid', quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate products in the same order', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      items: [
        { productId: '44444444-4444-4444-8444-444444444441', quantity: 1 },
        { productId: '44444444-4444-4444-8444-444444444441', quantity: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts verified payment transaction reference', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      payment: { transactionId: '22222222-2222-4222-8222-222222222222' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects browser-supplied payment success details', () => {
    const result = CreateOrderSchema.safeParse({
      ...baseOrder,
      payment: {
        status: 'paid',
        provider: 'demo',
        method: 'credit_card',
        code: 'DEMO-123',
        amount: 1000,
        currency: 'JPY',
        scope: 'required_items',
        coveredProductIds: ['44444444-4444-4444-8444-444444444441'],
      },
    });
    expect(result.success).toBe(false);
  });
});
