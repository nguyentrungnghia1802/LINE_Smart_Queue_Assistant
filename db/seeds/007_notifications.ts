import type { PoolClient } from 'pg';

import { ORG_ID, QUEUE_ENTRIES, USERS } from './_ids';

const notifications = [
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'queue_joined', 'line_push', 'delivered', 0, null],
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'queue_served', 'line_push', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'payment_required', 'line_push', 'delivered', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'queue_near_turn', 'line_push', 'pending', 0, null],
  [QUEUE_ENTRIES.ENTRY_3, USERS.CUSTOMER_3, 'queue_called', 'line_push', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_4, USERS.CUSTOMER_4, 'queue_called', 'line_push', 'delivered', 0, null],
  [
    QUEUE_ENTRIES.ENTRY_5,
    USERS.CUSTOMER_5,
    'queue_joined',
    'line_push',
    'failed',
    1,
    'Mock LINE API failure',
  ],
  [QUEUE_ENTRIES.ENTRY_7, USERS.CUSTOMER_2, 'queue_no_show', 'line_push', 'sent', 0, null],
] as const;

const lineUserByUserId: Record<string, string> = {
  [USERS.CUSTOMER_1]: 'UdemoCustomer1',
  [USERS.CUSTOMER_2]: 'UdemoCustomer2',
  [USERS.CUSTOMER_3]: 'UdemoCustomer3',
  [USERS.CUSTOMER_4]: 'UdemoCustomer4',
  [USERS.CUSTOMER_5]: 'UdemoCustomer5',
};

export async function seed(client: PoolClient): Promise<void> {
  await client.query(`DELETE FROM notifications WHERE event_key LIKE 'seed:%'`);

  for (const [entryId, userId, type, channel, status, retryCount, errorMessage] of notifications) {
    const lineUserId = lineUserByUserId[userId] ?? null;
    await client.query(
      `
        INSERT INTO notifications (
          organization_id, queue_entry_id, user_id, line_user_id, type,
          event_key, event_type, channel, status, payload,
          retry_count, attempt_count, next_retry_at, error_message, sent_at, delivered_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::text, $5::notification_type,
          CONCAT('seed:', ($2::uuid)::text, ':', ($5::notification_type)::text),
          ($5::notification_type)::text, $6::notification_channel, $7::notification_status,
          jsonb_build_object('seed', true, 'message', ($5::notification_type)::text),
          $8,
          $8,
          CASE WHEN $7 = 'failed' THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
          $9,
          CASE WHEN $7 IN ('sent', 'delivered') THEN NOW() - INTERVAL '5 minutes' ELSE NULL END,
          CASE WHEN $7 = 'delivered' THEN NOW() - INTERVAL '4 minutes' ELSE NULL END
        );
      `,
      [ORG_ID, entryId, userId, lineUserId, type, channel, status, retryCount, errorMessage]
    );
  }
}
