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
        ($1, $3, '受付カウンターA', '通常受付', 'open', 'walk_in', 'A', 200, 8, 900, 3, TRUE, 2, 5, '09:00', '18:00', '{"demo":true}'::jsonb, TRUE),
        ($2, $3, '優先受付', '優先対応用の受付', 'open', 'priority', 'VIP', 50, 3, 600, 2, TRUE, 1, 3, '09:00', '18:00', '{"demo":true}'::jsonb, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        queue_type = EXCLUDED.queue_type,
        prefix = EXCLUDED.prefix,
        max_capacity = EXCLUDED.max_capacity,
        daily_ticket_counter = GREATEST(queues.daily_ticket_counter, EXCLUDED.daily_ticket_counter),
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
    [QUEUES.COUNTER_A, QUEUES.VIP_LANE, ORG_ID]
  );
  await client.query(
    `INSERT INTO queue_translations (queue_id, locale, name, description) VALUES
       ($1, 'ja', '受付カウンターA', '通常受付'),
       ($1, 'vi', 'Quầy tiếp nhận A', 'Tiếp nhận thông thường'),
       ($1, 'en', 'Reception Counter A', 'General reception'),
       ($2, 'ja', '優先受付', '優先対応用の受付'),
       ($2, 'vi', 'Quầy ưu tiên', 'Tiếp nhận ưu tiên'),
       ($2, 'en', 'Priority Reception', 'Priority service reception')
     ON CONFLICT (queue_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
    [QUEUES.COUNTER_A, QUEUES.VIP_LANE]
  );
}
