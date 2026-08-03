import type { PoolClient } from 'pg';

import { ORG_ID, PRODUCTS } from './_ids';

const products = [
  [
    PRODUCTS.HAIRCUT,
    'DV1',
    'ヘアカット',
    'スタンダードなヘアカット',
    'service',
    4000,
    30,
    null,
    false,
  ],
  [
    PRODUCTS.HAIR_DYE,
    'DV2',
    'ヘアカラー',
    'カラーリングサービス',
    'service',
    12000,
    120,
    null,
    true,
  ],
  [PRODUCTS.HAIR_WASH, 'DV3', 'シャンプー', 'シャンプーとブロー', 'service', 2500, 20, null, false],
  [PRODUCTS.CHECKUP, 'DV4', '健康相談', '一般的な健康相談', 'service', 8000, 45, null, true],
  [PRODUCTS.PEACH_TEA, 'SP1', 'ピーチティー', '冷たいピーチティー', 'product', 450, 5, 30, false],
  [PRODUCTS.BUN_BO, 'SP2', 'ランチセット', '本日のランチセット', 'product', 1200, 10, 30, false],
  [PRODUCTS.WATER, 'SP3', 'ミネラルウォーター', 'ペットボトル飲料', 'product', 180, 3, 15, false],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  for (const [
    id,
    productCode,
    name,
    description,
    productType,
    price,
    serviceTime,
    maxWait,
    requiresPrepayment,
  ] of products) {
    await client.query(
      `
        INSERT INTO products (
          id, organization_id, product_code, name, description, image_url, product_type, price,
          service_time_minutes, max_wait_minutes, requires_prepayment, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::product_type, $8, $9, $10, $11, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          product_code = EXCLUDED.product_code,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          product_type = EXCLUDED.product_type,
          price = EXCLUDED.price,
          service_time_minutes = EXCLUDED.service_time_minutes,
          max_wait_minutes = EXCLUDED.max_wait_minutes,
          requires_prepayment = EXCLUDED.requires_prepayment,
          is_active = TRUE,
          updated_at = NOW();
      `,
      [
        id,
        ORG_ID,
        productCode,
        name,
        description,
        `https://placehold.co/512x320?text=${encodeURIComponent(name)}`,
        productType,
        price,
        serviceTime,
        maxWait,
        requiresPrepayment,
      ]
    );
    await client.query(
      `INSERT INTO product_translations (product_id, locale, name, description)
       VALUES ($1, 'ja', $2, $3)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [id, name, description]
    );
  }

  await client.query(
    `INSERT INTO organization_counters (
       organization_id, next_product_number, next_service_number
     )
     SELECT organization_id,
            COALESCE(MAX(SUBSTRING(product_code FROM 3)::BIGINT)
              FILTER (
                WHERE product_type = 'product'
                  AND product_code ~ '^SP[1-9][0-9]*$'
              ), 0) + 1,
            COALESCE(MAX(SUBSTRING(product_code FROM 3)::BIGINT)
              FILTER (
                WHERE product_type = 'service'
                  AND product_code ~ '^DV[1-9][0-9]*$'
              ), 0) + 1
     FROM products
     WHERE organization_id = $1
     GROUP BY organization_id
     ON CONFLICT (organization_id) DO UPDATE SET
       next_product_number = GREATEST(
         organization_counters.next_product_number,
         EXCLUDED.next_product_number
       ),
       next_service_number = GREATEST(
         organization_counters.next_service_number,
         EXCLUDED.next_service_number
       ),
       updated_at = NOW()`,
    [ORG_ID]
  );
}
