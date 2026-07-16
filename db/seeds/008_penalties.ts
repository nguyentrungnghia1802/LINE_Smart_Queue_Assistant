import type { PoolClient } from 'pg';

import { ORG_ID, QUEUE_ENTRIES, QUEUES, USERS } from './_ids';

const penalties = [
  [
    USERS.CUSTOMER_2,
    QUEUE_ENTRIES.ENTRY_7,
    'no_show',
    1,
    'Customer did not arrive after being called',
  ],
  [
    USERS.CUSTOMER_5,
    QUEUE_ENTRIES.ENTRY_6,
    'excessive_cancel',
    2,
    'Customer cancelled after joining queue multiple times',
  ],
] as const;

export async function seed(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM penalty_records');

  for (const [userId, entryId, penaltyType, points, reason] of penalties) {
    await client.query(
      `
        INSERT INTO penalty_records (
          organization_id, queue_id, queue_entry_id, user_id,
          penalty_type, points, reason, metadata
        )
        VALUES ($1, $2, $3, $4, $5::penalty_type, $6, $7, '{"seed":true}'::jsonb);
      `,
      [ORG_ID, QUEUES.COUNTER_A, entryId, userId, penaltyType, points, reason]
    );
  }
}
