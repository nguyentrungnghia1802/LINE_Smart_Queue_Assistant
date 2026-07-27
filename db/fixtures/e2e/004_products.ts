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
    null,
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
    null,
  ],
  [
    PRODUCTS.HAIR_WASH,
    'DV3',
    'シャンプー',
    'シャンプーとブロー',
    'service',
    2500,
    20,
    null,
    false,
    null,
  ],
  [PRODUCTS.CHECKUP, 'DV4', '健康相談', '一般的な健康相談', 'service', 8000, 45, null, true, null],
  [
    PRODUCTS.PEACH_TEA,
    'SP1',
    'ピーチティー',
    '冷たいピーチティー',
    'product',
    450,
    5,
    30,
    false,
    100,
  ],
  [
    PRODUCTS.BUN_BO,
    'SP2',
    'ランチセット',
    '本日のランチセット',
    'product',
    1200,
    10,
    30,
    false,
    50,
  ],
  [
    PRODUCTS.WATER,
    'SP3',
    'ミネラルウォーター',
    'ペットボトル飲料',
    'product',
    180,
    3,
    15,
    false,
    500,
  ],
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
    stock,
  ] of products) {
    await client.query(
      `
        INSERT INTO products (
          id, organization_id, branch_id, product_code, name, description, image_url, product_type, price,
          service_time_minutes, max_wait_minutes, requires_prepayment, stock_quantity, is_active
        )
        VALUES ($1, $2, NULL, $3, $4, $5, $6, $7::product_type, $8, $9, $10, $11, $12, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          branch_id = NULL,
          product_code = EXCLUDED.product_code,
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
        productCode,
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
