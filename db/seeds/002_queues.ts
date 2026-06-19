import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 002 — Queues for the demo organization.
 *
 * Creates:
 *   • Counter A (open, prefix 'A', avg 30 min service)
 *   • VIP Lane  (open, prefix 'VIP', priority lane)
 */
export async function seed002Queues(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO queues
       (id, organization_id, name, description, status, queue_type,
        prefix, avg_service_seconds, notify_ahead_positions,
        allow_skip, max_skips_before_penalty, is_active)
     VALUES
       ($1, $3, 'Counter A', 'Quầy phục vụ chính', 'open', 'walk_in',
        'A', 1800, 3, TRUE, 2, TRUE),
       ($2, $3, 'VIP Lane', 'Quầy ưu tiên VIP', 'open', 'priority',
        'VIP', 900, 2, FALSE, 0, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.queues.counterA, SEED_IDS.queues.vipLane, SEED_IDS.org]
  );

  console.info('[seed] 002 — 2 queues created (Counter A + VIP Lane)');
}
