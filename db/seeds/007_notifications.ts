import type { PoolClient } from 'pg';
import { QUEUE_ENTRIES, USERS } from './_ids';

const notifications = [
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'queue_joined', 'line_push', 'delivered', 0, null],
  [QUEUE_ENTRIES.ENTRY_1, USERS.CUSTOMER_1, 'queue_served', 'line_push', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'payment_required', 'line_push', 'delivered', 0, null],
  [QUEUE_ENTRIES.ENTRY_2, USERS.CUSTOMER_2, 'queue_near_turn', 'line_push', 'pending', 0, null],
  [QUEUE_ENTRIES.ENTRY_3, USERS.CUSTOMER_3, 'queue_called', 'line_push', 'sent', 0, null],
  [QUEUE_ENTRIES.ENTRY_4, USERS.CUSTOMER_4, 'queue_called', 'line_push', 'delivered', 0, null],
  [QUEUE_ENTRIES.ENTRY_5, USERS.CUSTOMER_5, 'queue_joined', 'line_push', 'failed', 1, 'Mock LINE API failure'],
  [QUEUE_ENTRIES.ENTRY_7, USERS.CUSTOMER_2, 'queue_no_show', 'line_push', 'sent', 0, null],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM notifications');

  for (const [entryId, userId, type, channel, status, retryCount, errorMessage] of notifications) {
    await client.query(
      `
        INSERT INTO notifications (
          queue_entry_id, user_id, type, channel, status, payload,
          retry_count, next_retry_at, error_message, sent_at, delivered_at
        )
        VALUES (
          $1, $2, $3::notification_type, $4::notification_channel, $5::notification_status,
          jsonb_build_object('seed', true, 'message', $3),
          $6,
          CASE WHEN $5 = 'failed' THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
          $7,
          CASE WHEN $5 IN ('sent', 'delivered') THEN NOW() - INTERVAL '5 minutes' ELSE NULL END,
          CASE WHEN $5 = 'delivered' THEN NOW() - INTERVAL '4 minutes' ELSE NULL END
        );
      `,
      [entryId, userId, type, channel, status, retryCount, errorMessage],
    );
  }
}
