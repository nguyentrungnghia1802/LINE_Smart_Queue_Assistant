import type { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { invalidateProductCatalog, productCatalogCache } from '../../utils/cache';
import { pool } from '../client';

export interface ProductRow {
  id: string;
  organization_id: string;
  product_code: string;
  queue_ids?: string[];
  name: string;
  description: string | null;
  image_url: string | null;
  price: string; // numeric comes back as string in node-postgres
  service_time_minutes: number;
  max_wait_minutes: number | null;
  requires_prepayment: boolean;
  stock_quantity: number | null;
  low_stock_threshold?: number;
  product_type: 'product' | 'service';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const productsRepository = {
  async findByOrg(orgId: string, locale: SupportedLocale = 'ja'): Promise<ProductRow[]> {
    const cacheKey = `org:${orgId}:${locale}`;
    const cached = productCatalogCache.get(cacheKey);
    if (cached !== null) return cached;

    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              NULL::INT AS stock_quantity,
              COALESCE(requested.name, tenant_default.name, japanese.name, p.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, p.description) AS description
       FROM products p
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN product_translations requested ON requested.product_id = p.id AND requested.locale = $2
       LEFT JOIN product_translations tenant_default ON tenant_default.product_id = p.id AND tenant_default.locale = o.default_locale
       LEFT JOIN product_translations japanese ON japanese.product_id = p.id AND japanese.locale = 'ja'
       WHERE p.organization_id = $1 AND p.is_active = TRUE ORDER BY p.created_at`,
      [orgId, locale]
    );
    productCatalogCache.set(cacheKey, rows);
    return rows;
  },

  async findByBranch(branchId: string, locale: SupportedLocale = 'ja'): Promise<ProductRow[]> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              inventory.stock_quantity AS stock_quantity,
              inventory.low_stock_threshold,
              COALESCE(requested.name, tenant_default.name, japanese.name, p.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, p.description) AS description,
              COALESCE(
                ARRAY_AGG(qp.queue_id ORDER BY qp.display_order, qp.queue_id)
                  FILTER (WHERE qp.is_active = TRUE),
                ARRAY[]::uuid[]
              ) AS queue_ids
       FROM products p
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN product_translations requested ON requested.product_id = p.id AND requested.locale = $2
       LEFT JOIN product_translations tenant_default ON tenant_default.product_id = p.id AND tenant_default.locale = o.default_locale
       LEFT JOIN product_translations japanese ON japanese.product_id = p.id AND japanese.locale = 'ja'
       JOIN queue_products qp
         ON qp.product_id = p.id
        AND qp.branch_id = $1
        AND qp.is_active = TRUE
       LEFT JOIN branch_product_inventories inventory
         ON inventory.branch_id = qp.branch_id
        AND inventory.product_id = p.id
       WHERE p.is_active = TRUE
       GROUP BY p.id, inventory.stock_quantity, inventory.low_stock_threshold,
                requested.name, requested.description, tenant_default.name,
                tenant_default.description, japanese.name, japanese.description
       ORDER BY p.created_at`,
      [branchId, locale]
    );
    return rows;
  },

  async findCatalogByBranch(
    branchId: string,
    locale: SupportedLocale = 'ja'
  ): Promise<ProductRow[]> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              inventory.stock_quantity AS stock_quantity,
              COALESCE(inventory.low_stock_threshold, 10) AS low_stock_threshold,
              COALESCE(requested.name, tenant_default.name, japanese.name, p.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, p.description) AS description
       FROM organization_branches branch
       JOIN products p ON p.organization_id = branch.organization_id AND p.is_active = TRUE
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN branch_product_inventories inventory
         ON inventory.branch_id = branch.id AND inventory.product_id = p.id
       LEFT JOIN product_translations requested ON requested.product_id = p.id AND requested.locale = $2
       LEFT JOIN product_translations tenant_default ON tenant_default.product_id = p.id AND tenant_default.locale = o.default_locale
       LEFT JOIN product_translations japanese ON japanese.product_id = p.id AND japanese.locale = 'ja'
       WHERE branch.id = $1
       ORDER BY p.created_at`,
      [branchId, locale]
    );
    return rows;
  },

  async findByQueue(queueId: string, locale: SupportedLocale = 'ja'): Promise<ProductRow[]> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              inventory.stock_quantity AS stock_quantity,
              inventory.low_stock_threshold,
              COALESCE(requested.name, tenant_default.name, japanese.name, p.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, p.description) AS description
       FROM queue_products qp
       JOIN products p ON p.id = qp.product_id
       LEFT JOIN branch_product_inventories inventory
         ON inventory.branch_id = qp.branch_id
        AND inventory.product_id = p.id
       JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN product_translations requested ON requested.product_id = p.id AND requested.locale = $2
       LEFT JOIN product_translations tenant_default ON tenant_default.product_id = p.id AND tenant_default.locale = o.default_locale
       LEFT JOIN product_translations japanese ON japanese.product_id = p.id AND japanese.locale = 'ja'
       WHERE qp.queue_id = $1
         AND qp.is_active = TRUE
         AND p.is_active = TRUE
       ORDER BY qp.display_order, p.created_at, p.id`,
      [queueId, locale]
    );
    return rows;
  },

  async findByOrgSlug(slug: string, locale: SupportedLocale = 'ja'): Promise<ProductRow[]> {
    const cacheKey = `slug:${slug}:${locale}`;
    const cached = productCatalogCache.get(cacheKey);
    if (cached !== null) return cached;

    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              NULL::INT AS stock_quantity,
              COALESCE(requested.name, tenant_default.name, japanese.name, p.name) AS name,
              COALESCE(requested.description, tenant_default.description, japanese.description, p.description) AS description
       FROM products p
       JOIN organizations o ON p.organization_id = o.id
       LEFT JOIN product_translations requested ON requested.product_id = p.id AND requested.locale = $2
       LEFT JOIN product_translations tenant_default ON tenant_default.product_id = p.id AND tenant_default.locale = o.default_locale
       LEFT JOIN product_translations japanese ON japanese.product_id = p.id AND japanese.locale = 'ja'
       WHERE o.slug = $1 AND p.is_active = TRUE
       ORDER BY p.created_at`,
      [slug, locale]
    );
    productCatalogCache.set(cacheKey, rows);
    return rows;
  },

  async findById(id: string): Promise<ProductRow | null> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
              NULL::INT AS stock_quantity,
              COALESCE(
                ARRAY_AGG(qp.queue_id ORDER BY qp.display_order, qp.queue_id)
                  FILTER (WHERE qp.is_active = TRUE),
                ARRAY[]::uuid[]
              ) AS queue_ids
       FROM products p
       LEFT JOIN queue_products qp ON qp.product_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    return rows[0] ?? null;
  },

  async create(
    data: {
      organizationId: string;
      productCode: string;
      name: string;
      description?: string;
      imageUrl?: string;
      price: number;
      serviceTimeMinutes: number;
      maxWaitMinutes?: number;
      requiresPrepayment: boolean;
      productType?: 'product' | 'service';
    },
    client?: PoolClient
  ): Promise<ProductRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<ProductRow>(
      `INSERT INTO products
         (organization_id, product_code, name, description, image_url, price, service_time_minutes,
          max_wait_minutes, requires_prepayment, product_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING products.*, NULL::INT AS stock_quantity`,
      [
        data.organizationId,
        data.productCode,
        data.name,
        data.description ?? null,
        data.imageUrl ?? null,
        data.price,
        data.serviceTimeMinutes,
        data.maxWaitMinutes ?? null,
        data.requiresPrepayment,
        data.productType ?? 'service',
      ]
    );
    invalidateProductCatalog(data.organizationId);
    await executor.query(
      `INSERT INTO product_translations (product_id, locale, name, description)
       VALUES ($1,'ja',$2,$3)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [rows[0].id, data.name, data.description ?? null]
    );
    return rows[0];
  },

  async nextCatalogCode(
    organizationId: string,
    productType: 'product' | 'service',
    client: PoolClient
  ): Promise<string> {
    const counterColumn = productType === 'service' ? 'next_service_number' : 'next_product_number';
    const prefix = productType === 'service' ? 'DV' : 'SP';
    const { rows } = await client.query<{ value: string }>(
      `INSERT INTO organization_counters
         (organization_id, next_product_number, next_service_number)
       VALUES (
         $1,
         CASE WHEN $2 = 'product' THEN 2 ELSE 1 END,
         CASE WHEN $2 = 'service' THEN 2 ELSE 1 END
       )
       ON CONFLICT (organization_id) DO UPDATE
       SET ${counterColumn} = organization_counters.${counterColumn} + 1,
           updated_at = NOW()
       RETURNING (${counterColumn} - 1)::TEXT AS value`,
      [organizationId, productType]
    );
    return `${prefix}${rows[0].value}`;
  },

  async assignCode(
    id: string,
    organizationId: string,
    productCode: string,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE products
       SET product_code = $3
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId, productCode]
    );
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      price: number;
      serviceTimeMinutes: number;
      maxWaitMinutes: number | null;
      requiresPrepayment: boolean;
      productType: 'product' | 'service';
      isActive: boolean;
    }>,
    client?: PoolClient
  ): Promise<ProductRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const map: Record<string, string> = {
      name: 'name',
      description: 'description',
      imageUrl: 'image_url',
      price: 'price',
      serviceTimeMinutes: 'service_time_minutes',
      maxWaitMinutes: 'max_wait_minutes',
      requiresPrepayment: 'requires_prepayment',
      productType: 'product_type',
      isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`);
        values.push((data as Record<string, unknown>)[key]);
      }
    }
    if (fields.length === 0) {
      const { rows } = await (client ?? pool).query<ProductRow>(
        'SELECT products.*, NULL::INT AS stock_quantity FROM products WHERE id = $1',
        [id]
      );
      return rows[0] ?? null;
    }

    values.push(id);
    const executor = client ?? pool;
    const { rows } = await executor.query<ProductRow>(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING products.*, NULL::INT AS stock_quantity`,
      values
    );
    const updated = rows[0] ?? null;
    if (updated) {
      invalidateProductCatalog(updated.organization_id);
      if (data.name !== undefined || data.description !== undefined) {
        await executor.query(
          `INSERT INTO product_translations (product_id, locale, name, description)
           VALUES ($1,'ja',$2,$3)
           ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
          [updated.id, updated.name, updated.description]
        );
      }
    }
    return updated;
  },

  async findProductIdsByQueue(queueId: string, client?: PoolClient): Promise<string[]> {
    const executor = client ?? pool;
    const { rows } = await executor.query<{ product_id: string }>(
      `SELECT product_id
       FROM queue_products
       WHERE queue_id = $1 AND is_active = TRUE
       ORDER BY display_order, product_id`,
      [queueId]
    );
    return rows.map((row) => row.product_id);
  },

  async syncProductsForQueue(
    queueId: string,
    organizationId: string,
    branchId: string,
    productIds: string[],
    client: PoolClient
  ): Promise<void> {
    const uniqueProductIds = [...new Set(productIds)];
    const valid = await client.query<{ id: string }>(
      `SELECT id
       FROM products
       WHERE id = ANY($1::uuid[])
         AND organization_id = $2
         AND is_active = TRUE
       FOR UPDATE`,
      [uniqueProductIds, organizationId]
    );
    if (valid.rowCount !== uniqueProductIds.length) {
      throw new Error('One or more products are outside the organization catalog');
    }
    await client.query(
      `UPDATE queue_products
       SET is_active = FALSE, updated_at = NOW()
       WHERE queue_id = $1`,
      [queueId]
    );
    if (uniqueProductIds.length === 0) return;
    await client.query(
      `INSERT INTO queue_products (
         queue_id, product_id, organization_id, branch_id, is_active, display_order
       )
       SELECT $1, selected.product_id, $3, $4, TRUE, selected.ordinality - 1
       FROM UNNEST($2::uuid[]) WITH ORDINALITY AS selected(product_id, ordinality)
       ON CONFLICT (queue_id, product_id) DO UPDATE SET
         is_active = TRUE,
         display_order = EXCLUDED.display_order,
         updated_at = NOW()`,
      [queueId, uniqueProductIds, organizationId, branchId]
    );
    await client.query(
      `INSERT INTO branch_product_inventories
         (branch_id, product_id, organization_id, stock_quantity)
       SELECT $1, p.id, $2, NULL
       FROM products p
       WHERE p.id = ANY($3::uuid[])
       ON CONFLICT (branch_id, product_id) DO NOTHING`,
      [branchId, organizationId, uniqueProductIds]
    );
  },

  async updateBranchStock(
    branchId: string,
    productId: string,
    organizationId: string,
    stockQuantity: number | null,
    lowStockThreshold: number
  ): Promise<ProductRow | null> {
    await pool.query(
      `INSERT INTO branch_product_inventories
         (branch_id, product_id, organization_id, stock_quantity, low_stock_threshold)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET
         stock_quantity = EXCLUDED.stock_quantity,
         low_stock_threshold = EXCLUDED.low_stock_threshold`,
      [branchId, productId, organizationId, stockQuantity, lowStockThreshold]
    );
    const products = await this.findCatalogByBranch(branchId);
    return products.find((product) => product.id === productId) ?? null;
  },

  async softDelete(id: string): Promise<void> {
    const existing = await this.findById(id);
    await pool.query(`UPDATE products SET is_active = FALSE WHERE id = $1`, [id]);
    if (existing) invalidateProductCatalog(existing.organization_id);
  },
};
