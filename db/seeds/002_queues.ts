import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 002 — Two sample queues attached to the seed organization.
 *
 * Creates:
 *   • Queue A   : Walk-in Counter A  (prefix='A',   avg 5 min service, max_capacity NULL)
 *   • Queue VIP : VIP Lane           (prefix='VIP', avg 3 min service, max_capacity=10)
 */
export async function seed002Queues(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO queues
       (id, organization_id, name, description, prefix, queue_type,
        avg_service_seconds, notify_ahead_positions,
        allow_skip, max_skips_before_penalty, status, is_active)
     VALUES
       ($1, $3, 'Walk-in Counter A', 'General walk-in queuing counter',
        'A', 'walk_in', 300, 3, TRUE, 2, 'open', TRUE),
       ($2, $3, 'VIP Lane', 'Priority lane for VIP guests',
        'VIP', 'walk_in', 180, 2, TRUE, 1, 'open', TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.queues.counterA, SEED_IDS.queues.vipLane, SEED_IDS.org]
  );

  // Update max_capacity separately for VIP (NULL means unlimited for Counter A)
  await client.query(`UPDATE queues SET max_capacity = 10 WHERE id = $1`, [
    SEED_IDS.queues.vipLane,
  ]);

  console.info('[seed] 002 — 2 queues created (Counter A + VIP Lane)');
}
