import type { PoolClient } from 'pg';
import { ORG_ID, PUBLIC_QR_TOKEN } from './_ids';

export async function seed(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO organizations (
        id, name, slug, public_qr_token, logo_url, phone, address,
        payment_info, line_channel_id, line_oa_basic_id, timezone, settings, is_active
      )
      VALUES (
        $1,
        'Queue Lab Demo',
        'queue-lab-demo',
        $2,
        'https://placehold.co/256x256?text=Queue+Lab',
        '0900000000',
        'Ha Noi, Viet Nam',
        'Mock payment: MB Bank 123456789 - QUEUE LAB DEMO',
        'demo-line-channel-id',
        '@queue-lab-demo',
        'Asia/Bangkok',
        '{"currency":"VND","allowMockPayment":true}'::jsonb,
        TRUE
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
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `,
    [ORG_ID, PUBLIC_QR_TOKEN],
  );
}
