/**
 * Unit tests for products.validator — specifically the productType field.
 *
 * Verifies:
 *   1. `productType` defaults to 'service' when omitted.
 *   2. Both 'product' and 'service' are accepted.
 *   3. Invalid values are rejected.
 */
import { NUMERIC_LIMITS } from '@line-queue/shared';

import {
  CreateProductSchema,
  UpdateBranchStockSchema,
  UpdateProductSchema,
} from '../products.validator';

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

  it('allows creation before a queue selects the product', () => {
    const result = CreateProductSchema.safeParse(baseProduct);
    expect(result.success).toBe(true);
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

  it('rejects catalog-level stock because inventory belongs to a branch', () => {
    const result = CreateProductSchema.safeParse({
      ...baseProduct,
      productType: 'product',
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

  it('rejects unrealistic product and branch inventory values', () => {
    expect(
      CreateProductSchema.safeParse({
        ...baseProduct,
        price: NUMERIC_LIMITS.productPrice.max + 1,
      }).success
    ).toBe(false);
    expect(
      UpdateBranchStockSchema.safeParse({
        stockQuantity: -1,
        lowStockThreshold: NUMERIC_LIMITS.lowStockThreshold.max + 1,
      }).success
    ).toBe(false);
  });

  it('rejects an empty product update', () => {
    expect(UpdateProductSchema.safeParse({}).success).toBe(false);
  });
});
