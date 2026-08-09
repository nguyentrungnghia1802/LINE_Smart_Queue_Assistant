import { NUMERIC_LIMITS } from '@line-queue/shared';

import { CreatePaymentIntentSchema } from '../payments.validator';

const productId = '44444444-4444-4444-8444-444444444441';

describe('CreatePaymentIntentSchema', () => {
  it('rejects duplicate products in a payment request', () => {
    const result = CreatePaymentIntentSchema.safeParse({
      orgSlug: 'test-store',
      items: [
        { productId, quantity: 1 },
        { productId, quantity: 2 },
      ],
      scope: 'all_items',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a quantity above the order-item limit', () => {
    expect(
      CreatePaymentIntentSchema.safeParse({
        orgSlug: 'test-store',
        items: [{ productId, quantity: NUMERIC_LIMITS.orderItemQuantity.max + 1 }],
        scope: 'all_items',
      }).success
    ).toBe(false);
  });
});
