/**
 * Unit tests for products.validator — specifically the productType field.
 *
 * Verifies:
 *   1. `productType` defaults to 'service' when omitted.
 *   2. Both 'product' and 'service' are accepted.
 *   3. Invalid values are rejected.
 */
import { CreateProductSchema } from '../products.validator';

const baseProduct = {
  name: 'Test Product',
  price: 100000,
  serviceTimeMinutes: 30,
  requiresPrepayment: false,
};

describe('CreateProductSchema — productType field', () => {
  it('defaults to "service" when productType is omitted', () => {
    const result = CreateProductSchema.safeParse(baseProduct);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productType).toBe('service');
    }
  });

  it('accepts "service" explicitly', () => {
    const result = CreateProductSchema.safeParse({ ...baseProduct, productType: 'service' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productType).toBe('service');
    }
  });

  it('accepts "product" explicitly', () => {
    const result = CreateProductSchema.safeParse({ ...baseProduct, productType: 'product' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productType).toBe('product');
    }
  });

  it('rejects invalid productType values', () => {
    const result = CreateProductSchema.safeParse({ ...baseProduct, productType: 'goods' });
    expect(result.success).toBe(false);
  });

  it('rejects null productType', () => {
    const result = CreateProductSchema.safeParse({ ...baseProduct, productType: null });
    expect(result.success).toBe(false);
  });
});
