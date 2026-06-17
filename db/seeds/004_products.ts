import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 004 — Sample products/services for the demo organization.
 *
 * Demonstrates both product_type values:
 *   • 'service'  — hair-related services (haircut, dyeing)
 *   • 'product'  — retail items (shampoo, conditioner)
 */
export async function seed004Products(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO products
       (id, organization_id, name, description, price, service_time_minutes,
        requires_prepayment, product_type, is_active)
     VALUES
       ($1, $5, 'Cắt tóc nam',    'Cắt và tạo kiểu tóc nam',          120000, 30,  FALSE, 'service', TRUE),
       ($2, $5, 'Nhuộm tóc',      'Nhuộm màu + dưỡng tóc',            350000, 120, TRUE,  'service', TRUE),
       ($3, $5, 'Dầu gội đầu',    'Dầu gội chăm sóc tóc 250ml',        85000,  5,  FALSE, 'product', TRUE),
       ($4, $5, 'Dầu xả tóc',     'Dầu xả phục hồi tóc 200ml',         95000,  5,  FALSE, 'product', TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [
      SEED_IDS.products.haircut,
      SEED_IDS.products.dyeHair,
      SEED_IDS.products.shampoo,
      SEED_IDS.products.conditioner,
      SEED_IDS.org,
    ]
  );

  console.info('[seed] 004 — 4 products/services created (2 services + 2 products)');
}
