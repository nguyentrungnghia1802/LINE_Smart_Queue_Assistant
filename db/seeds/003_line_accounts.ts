import type { PoolClient } from 'pg';
import { USERS } from './_ids';

const lineAccounts = [
  [USERS.CUSTOMER_1, 'UdemoCustomer1', 'Customer Demo'],
  [USERS.CUSTOMER_2, 'UdemoCustomer2', 'Customer Two'],
  [USERS.CUSTOMER_3, 'UdemoCustomer3', 'Customer Three'],
  [USERS.CUSTOMER_4, 'UdemoCustomer4', 'Customer Four'],
  [USERS.CUSTOMER_5, 'UdemoCustomer5', 'Customer Five'],
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
      [userId, lineUserId, displayName],
    );
  }
}
