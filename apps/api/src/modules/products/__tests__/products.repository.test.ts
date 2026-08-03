import type { PoolClient } from 'pg';

import { productsRepository } from '../../../db/repositories/products.repository';

describe('productsRepository catalog numbering', () => {
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
});
