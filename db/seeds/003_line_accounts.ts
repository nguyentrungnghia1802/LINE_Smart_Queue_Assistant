import type { PoolClient } from 'pg';

import { USERS } from './_ids';

const lineAccounts = [
  [USERS.CUSTOMER_1, 'UdemoCustomer1', '山田 太郎'],
  [USERS.CUSTOMER_2, 'UdemoCustomer2', '佐藤 花子'],
  [USERS.CUSTOMER_3, 'UdemoCustomer3', '鈴木 一郎'],
  [USERS.CUSTOMER_4, 'UdemoCustomer4', '高橋 美咲'],
  [USERS.CUSTOMER_5, 'UdemoCustomer5', '田中 健太'],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  for (const [userId, lineUserId, displayName] of lineAccounts) {
    await client.query(
      `
        INSERT INTO line_accounts (user_id, line_user_id, display_name, picture_url, status_message, is_linked)
        VALUES ($1, $2, $3, NULL, 'Demo LINE account', TRUE)
        ON CONFLICT (line_user_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          display_name = EXCLUDED.display_name,
          picture_url = EXCLUDED.picture_url,
          status_message = EXCLUDED.status_message,
          is_linked = TRUE,
          last_synced_at = NOW();
      `,
      [userId, lineUserId, displayName]
    );
  }
}
