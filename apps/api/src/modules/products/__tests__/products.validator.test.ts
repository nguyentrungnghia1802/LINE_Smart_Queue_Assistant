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
  queueIds: ['11111111-1111-4111-8111-111111111111'],
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

  it('requires at least one queue assignment', () => {
    const result = CreateProductSchema.safeParse({ ...baseProduct, queueIds: [] });
    expect(result.success).toBe(false);
  });

  it('accepts the same-origin media URL returned by the image upload endpoint', () => {
    const result = CreateProductSchema.safeParse({
      ...baseProduct,
      imageUrl: '/media/product_image/2026-07-25/0d73ca0a-4e0d-4fd7-95f5-21eb6d4ec0d8.webp',
    });

    expect(result.success).toBe(true);
  });

  it('rejects arbitrary relative paths as product images', () => {
    const result = CreateProductSchema.safeParse({
      ...baseProduct,
      imageUrl: '/images/product.png',
    });

    expect(result.success).toBe(false);
  });

  it('rejects finite stock for services', () => {
    const result = CreateProductSchema.safeParse({
      ...baseProduct,
      productType: 'service',
      stockQuantity: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects required prepayment when the price is zero', () => {
    const result = CreateProductSchema.safeParse({
      ...baseProduct,
      price: 0,
      requiresPrepayment: true,
    });
    expect(result.success).toBe(false);
  });
});
