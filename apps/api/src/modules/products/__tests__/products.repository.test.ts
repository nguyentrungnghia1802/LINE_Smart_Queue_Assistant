import type { PoolClient } from 'pg';

import { productsRepository } from '../../../db/repositories/products.repository';

describe('productsRepository', () => {
  it.each([
    ['product', 'next_product_number', 'SP7'],
    ['service', 'next_service_number', 'DV7'],
  ] as const)(
    'allocates a %s code atomically from organization counters',
    async (productType, counterColumn, expectedCode) => {
      const query = jest.fn().mockResolvedValue({ rows: [{ value: '7' }] });
      const client = { query } as unknown as PoolClient;

      await expect(
        productsRepository.nextCatalogCode('organization-001', productType, client)
      ).resolves.toBe(expectedCode);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO organization_counters');
      expect(sql).toContain('ON CONFLICT (organization_id) DO UPDATE');
      expect(sql).toContain(`${counterColumn} = organization_counters.${counterColumn} + 1`);
      expect(sql).not.toContain('MAX(');
      expect(params).toEqual(['organization-001', productType]);
    }
  );

  it('returns only active queue assignments backed by an active product and queue', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ product_id: 'product-001' }] });
    const client = { query } as unknown as PoolClient;

    await expect(productsRepository.findProductIdsByQueue('queue-001', client)).resolves.toEqual([
      'product-001',
    ]);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JOIN products product');
    expect(sql).toContain('product.is_active = TRUE');
    expect(sql).toContain('JOIN queues queue');
    expect(sql).toContain('queue.is_active = TRUE');
    expect(params).toEqual(['queue-001']);
  });

  it('soft-deactivates a product and its queue assignments atomically', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as PoolClient;

    await productsRepository.softDelete('product-001', client);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('UPDATE products');
    expect(sql).toContain('UPDATE queue_products');
    expect(sql).toContain('WHERE product_id = $1');
    expect(params).toEqual(['product-001']);
  });
});
