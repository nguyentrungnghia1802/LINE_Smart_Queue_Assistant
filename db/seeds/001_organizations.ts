import type { PoolClient } from 'pg';

import { ORG_ID, PUBLIC_QR_TOKEN } from './_ids';

export async function seed(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO organizations (
        id, name, slug, public_qr_token, logo_url, phone, address,
        payment_info, line_channel_id, line_oa_basic_id, timezone, settings, is_active,
        postal_code, prefecture, city, address_line1, address_line2
      )
      VALUES (
        $1,
        'スマート受付 東京店',
        'queue-lab-demo',
        $2,
        'https://placehold.co/256x256?text=Smart+Queue',
        '0900000000',
        '〒100-0001 東京都千代田区千代田1-1',
        'デモ決済のみ利用できます',
        'demo-line-channel-id',
        '@queue-lab-demo',
        'Asia/Tokyo',
        '{"currency":"JPY","allowMockPayment":true}'::jsonb,
        TRUE,
        '100-0001', '東京都', '千代田区', '千代田1-1', NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        public_qr_token = EXCLUDED.public_qr_token,
        logo_url = EXCLUDED.logo_url,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        payment_info = EXCLUDED.payment_info,
        line_channel_id = EXCLUDED.line_channel_id,
        line_oa_basic_id = EXCLUDED.line_oa_basic_id,
        timezone = EXCLUDED.timezone,
        settings = EXCLUDED.settings,
        postal_code = EXCLUDED.postal_code,
        prefecture = EXCLUDED.prefecture,
        city = EXCLUDED.city,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `,
    [ORG_ID, PUBLIC_QR_TOKEN]
  );

  await client.query(
    `INSERT INTO organization_business_hours
       (organization_id, weekday, is_closed, opens_at, closes_at)
     SELECT $1, day, day = 0,
            CASE WHEN day = 0 THEN NULL ELSE '09:00'::time END,
            CASE WHEN day = 0 THEN NULL ELSE '18:00'::time END
     FROM generate_series(0, 6) AS day
     ON CONFLICT (organization_id, weekday) DO UPDATE SET
       is_closed = EXCLUDED.is_closed,
       opens_at = EXCLUDED.opens_at,
       closes_at = EXCLUDED.closes_at`,
    [ORG_ID]
  );
}
