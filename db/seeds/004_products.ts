import type { PoolClient } from 'pg';

import { ORG_ID, PRODUCTS } from './_ids';

const products = [
  [
    PRODUCTS.HAIRCUT,
    'ヘアカット',
    'スタンダードなヘアカット',
    'service',
    4000,
    30,
    null,
    false,
    null,
  ],
  [
    PRODUCTS.HAIR_DYE,
    'ヘアカラー',
    'カラーリングサービス',
    'service',
    12000,
    120,
    null,
    true,
    null,
  ],
  [PRODUCTS.HAIR_WASH, 'シャンプー', 'シャンプーとブロー', 'service', 2500, 20, null, false, null],
  [PRODUCTS.CHECKUP, '健康相談', '一般的な健康相談', 'service', 8000, 45, null, true, null],
  [PRODUCTS.PEACH_TEA, 'ピーチティー', '冷たいピーチティー', 'product', 450, 5, 30, false, 100],
  [PRODUCTS.BUN_BO, 'ランチセット', '本日のランチセット', 'product', 1200, 10, 30, false, 50],
  [PRODUCTS.WATER, 'ミネラルウォーター', 'ペットボトル飲料', 'product', 180, 3, 15, false, 500],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  for (const [
    id,
    name,
    description,
    productType,
    price,
    serviceTime,
    maxWait,
    requiresPrepayment,
    stock,
  ] of products) {
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
      ]
    );
    await client.query(
      `INSERT INTO product_translations (product_id, locale, name, description)
       VALUES ($1, 'ja', $2, $3)
       ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [id, name, description]
    );
  }
}
