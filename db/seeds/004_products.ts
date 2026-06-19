import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 004 — Products/services for the demo organization.
 *
 * 3 services + 3 products = 6 total, with varying service_time_minutes.
 * At least 1 item has requires_prepayment = TRUE.
 */
export async function seed004Products(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO products
       (id, organization_id, name, description, price, service_time_minutes,
        requires_prepayment, product_type, is_active)
     VALUES
       ($1,  $7, 'Cắt tóc nam',       'Cắt và tạo kiểu tóc nam',             120000,  30, FALSE, 'service', TRUE),
       ($2,  $7, 'Nhuộm tóc',         'Nhuộm màu + dưỡng tóc chuyên nghiệp', 350000, 120, TRUE,  'service', TRUE),
       ($3,  $7, 'Uốn tóc',           'Uốn định hình + dưỡng tóc',           450000, 150, TRUE,  'service', TRUE),
       ($4,  $7, 'Dầu gội đầu 250ml', 'Dầu gội chăm sóc tóc',                 85000,   5, FALSE, 'product', TRUE),
       ($5,  $7, 'Dầu xả tóc 200ml',  'Dầu xả phục hồi tóc',                  95000,   5, FALSE, 'product', TRUE),
       ($6,  $7, 'Ủ tóc phục hồi',    'Ủ dưỡng phục hồi tóc hư tổn',         180000,  45, FALSE, 'product', TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [
      SEED_IDS.products.haircut,
      SEED_IDS.products.dyeHair,
      SEED_IDS.products.perm,
      SEED_IDS.products.shampoo,
      SEED_IDS.products.conditioner,
      SEED_IDS.products.hairMask,
      SEED_IDS.org,
    ]
  );

  console.info('[seed] 004 — 6 products/services created (3 services + 3 products)');
}
