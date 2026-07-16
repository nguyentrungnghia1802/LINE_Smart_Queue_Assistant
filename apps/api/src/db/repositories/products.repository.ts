import type { SupportedLocale } from '@line-queue/shared';

import { productCatalogCache } from '../../utils/cache';
import { pool } from '../client';

export interface ProductRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string; // numeric comes back as string in node-postgres
  service_time_minutes: number;
  max_wait_minutes: number | null;
  requires_prepayment: boolean;
  stock_quantity: number | null;
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

  async findByOrgSlug(slug: string, locale: SupportedLocale = 'ja'): Promise<ProductRow[]> {
    const cacheKey = `slug:${slug}:${locale}`;
    const cached = productCatalogCache.get(cacheKey);
    if (cached !== null) return cached;

    const { rows } = await pool.query<ProductRow>(
      `SELECT p.*,
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
    const { rows } = await pool.query<ProductRow>(`SELECT * FROM products WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async create(data: {
    organizationId: string;
    name: string;
    description?: string;
    imageUrl?: string;
    price: number;
    serviceTimeMinutes: number;
    maxWaitMinutes?: number;
    requiresPrepayment: boolean;
    stockQuantity?: number;
    productType?: 'product' | 'service';
  }): Promise<ProductRow> {
    const { rows } = await pool.query<ProductRow>(
      `INSERT INTO products
         (organization_id, name, description, image_url, price, service_time_minutes,
          max_wait_minutes, requires_prepayment, stock_quantity, product_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.organizationId,
        data.name,
        data.description ?? null,
        data.imageUrl ?? null,
        data.price,
        data.serviceTimeMinutes,
        data.maxWaitMinutes ?? null,
        data.requiresPrepayment,
        data.stockQuantity ?? null,
        data.productType ?? 'service',
      ]
    );
    productCatalogCache.invalidate(`org:${data.organizationId}`);
    await pool.query(
      `INSERT INTO product_translations (product_id, locale, name, description)
       VALUES ($1,'ja',$2,$3)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [rows[0].id, data.name, data.description ?? null]
    );
    return rows[0];
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
      stockQuantity: number | null;
      productType: 'product' | 'service';
      isActive: boolean;
    }>
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
      stockQuantity: 'stock_quantity',
      productType: 'product_type',
      isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`);
        values.push((data as Record<string, unknown>)[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await pool.query<ProductRow>(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    const updated = rows[0] ?? null;
    if (updated) {
      productCatalogCache.invalidate(`org:${updated.organization_id}`);
      if (data.name !== undefined || data.description !== undefined) {
        await pool.query(
          `INSERT INTO product_translations (product_id, locale, name, description)
           VALUES ($1,'ja',$2,$3)
           ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
          [updated.id, updated.name, updated.description]
        );
      }
    }
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    const existing = await this.findById(id);
    await pool.query(`UPDATE products SET is_active = FALSE WHERE id = $1`, [id]);
    if (existing) productCatalogCache.invalidate(`org:${existing.organization_id}`);
  },
};
