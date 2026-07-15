import type { PoolClient } from 'pg';
import { ORG_ID, QUEUES } from './_ids';

export async function seed(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO queues (
        id, organization_id, name, description, status, queue_type, prefix,
        max_capacity, daily_ticket_counter, avg_service_seconds,
        notify_ahead_positions, allow_skip, max_skips_before_penalty,
        auto_no_show_minutes, opens_at, closes_at, settings, is_active
      )
      VALUES
        ($1, $3, 'Counter A', 'Main walk-in queue', 'open', 'walk_in', 'A', 200, 8, 900, 3, TRUE, 2, 5, '08:00', '20:00', '{"demo":true}'::jsonb, TRUE),
        ($2, $3, 'VIP Lane', 'Priority queue for VIP or urgent cases', 'open', 'priority', 'VIP', 50, 3, 600, 2, TRUE, 1, 3, '08:00', '20:00', '{"demo":true}'::jsonb, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        queue_type = EXCLUDED.queue_type,
        prefix = EXCLUDED.prefix,
        max_capacity = EXCLUDED.max_capacity,
        daily_ticket_counter = EXCLUDED.daily_ticket_counter,
        avg_service_seconds = EXCLUDED.avg_service_seconds,
        notify_ahead_positions = EXCLUDED.notify_ahead_positions,
        allow_skip = EXCLUDED.allow_skip,
        max_skips_before_penalty = EXCLUDED.max_skips_before_penalty,
        auto_no_show_minutes = EXCLUDED.auto_no_show_minutes,
        opens_at = EXCLUDED.opens_at,
        closes_at = EXCLUDED.closes_at,
        settings = EXCLUDED.settings,
        is_active = TRUE,
        updated_at = NOW();
    `,
    [QUEUES.COUNTER_A, QUEUES.VIP_LANE, ORG_ID],
  );
}
