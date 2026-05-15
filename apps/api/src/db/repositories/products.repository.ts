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
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const productsRepository = {
  async findByOrg(orgId: string): Promise<ProductRow[]> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT * FROM products WHERE organization_id = $1 AND is_active = TRUE ORDER BY created_at`,
      [orgId]
    );
    return rows;
  },

  async findByOrgSlug(slug: string): Promise<ProductRow[]> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT p.* FROM products p
       JOIN organizations o ON p.organization_id = o.id
       WHERE o.slug = $1 AND p.is_active = TRUE
       ORDER BY p.created_at`,
      [slug]
    );
    return rows;
  },

  async findById(id: string): Promise<ProductRow | null> {
    const { rows } = await pool.query<ProductRow>(
      `SELECT * FROM products WHERE id = $1`,
      [id]
    );
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
  }): Promise<ProductRow> {
    const { rows } = await pool.query<ProductRow>(
      `INSERT INTO products
         (organization_id, name, description, image_url, price, service_time_minutes,
          max_wait_minutes, requires_prepayment, stock_quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
      ]
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
    return rows[0] ?? null;
  },

  async softDelete(id: string): Promise<void> {
    await pool.query(`UPDATE products SET is_active = FALSE WHERE id = $1`, [id]);
  },
};
