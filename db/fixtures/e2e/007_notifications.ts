import type { PoolClient } from 'pg';

import { ORG_ID, QUEUE_ENTRIES, USERS } from './_ids';

const notifications = [
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'booking_created', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'completed', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'booking_created', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'eta_warning', 'pending', 0, null],
  [QUEUE_ENTRIES.ENTRY_3, USERS.CUSTOMER_3, 'called', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_4, USERS.CUSTOMER_4, 'called', 'sent', 0, null],
  [
    QUEUE_ENTRIES.ENTRY_5,
    USERS.CUSTOMER_5,
    'booking_created',
    'failed',
    1,
    'Mock LINE API failure',
  ],
  [QUEUE_ENTRIES.ENTRY_7, USERS.CUSTOMER_2, 'no_show', 'sent', 0, null],
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

  for (const [entryId, userId, eventType, status, attemptCount, lastError] of notifications) {
    const lineUserId = lineUserByUserId[userId] ?? null;
    await client.query(
      `
        INSERT INTO notifications (
          organization_id, queue_entry_id, user_id, line_user_id,
          event_key, event_type, channel, status, payload,
          attempt_count, next_retry_at, last_error, sent_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::text,
          CONCAT('seed:', ($2::uuid)::text, ':', $5::text),
          $5::text, 'line_push', $6::notification_status,
          jsonb_build_object('seed', true, 'message', $5::text),
          $7,
          NULL,
          $8,
          CASE WHEN $6 = 'sent' THEN NOW() - INTERVAL '5 minutes' ELSE NULL END
        );
      `,
      [ORG_ID, entryId, userId, lineUserId, eventType, status, attemptCount, lastError]
    );
  }
}
