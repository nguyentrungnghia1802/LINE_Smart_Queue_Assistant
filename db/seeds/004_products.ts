import type { PoolClient } from 'pg';
import { ORG_ID, PRODUCTS } from './_ids';

const products = [
  [PRODUCTS.HAIRCUT, 'Cắt tóc nam', 'Basic men haircut service', 'service', 80000, 30, null, false, null],
  [PRODUCTS.HAIR_DYE, 'Nhuộm tóc', 'Hair coloring service', 'service', 450000, 120, null, true, null],
  [PRODUCTS.HAIR_WASH, 'Gội đầu', 'Hair wash service', 'service', 50000, 20, null, false, null],
  [PRODUCTS.CHECKUP, 'Khám tổng quát', 'General health checkup', 'service', 200000, 45, null, true, null],
  [PRODUCTS.PEACH_TEA, 'Trà đào', 'Peach tea', 'product', 35000, 5, 30, false, 100],
  [PRODUCTS.BUN_BO, 'Bún bò', 'Food item', 'product', 50000, 10, 30, false, 50],
  [PRODUCTS.WATER, 'Nước suối', 'Bottled water', 'product', 10000, 3, 15, false, 500],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  for (const [id, name, description, productType, price, serviceTime, maxWait, requiresPrepayment, stock] of products) {
    await client.query(
      `
        INSERT INTO products (
          id, organization_id, name, description, image_url, product_type, price,
          service_time_minutes, max_wait_minutes, requires_prepayment, stock_quantity, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6::product_type, $7, $8, $9, $10, $11, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          product_type = EXCLUDED.product_type,
          price = EXCLUDED.price,
          service_time_minutes = EXCLUDED.service_time_minutes,
          max_wait_minutes = EXCLUDED.max_wait_minutes,
          requires_prepayment = EXCLUDED.requires_prepayment,
          stock_quantity = EXCLUDED.stock_quantity,
          is_active = TRUE,
          updated_at = NOW();
      `,
      [
        id,
        ORG_ID,
        name,
        description,
        `https://placehold.co/512x320?text=${encodeURIComponent(name)}`,
        productType,
        price,
        serviceTime,
        maxWait,
        requiresPrepayment,
        stock,
      ],
    );
  }
}
