import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 003 — Test data: 5 LINE customers + queue entries for UI/API testing.
 *
 * Counter A  (queue_id: counterA):
 *   A-001 … A-005  waiting   (5 entries)
 *   A-006          called    (called_at set)
 *   A-007          serving   (called_at + serving_at set)
 *
 * VIP Lane (queue_id: vipLane):
 *   VIP-001, VIP-002  waiting (2 entries)
 *
 * queue_histories:
 *   3 completed entries for Counter A (analytics / history panel)
 *
 * notifications:
 *   1 sent notification (notification display tests)
 */
export async function seed003TestData(client: Client): Promise<void> {
  // ── Customer users ─────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO users (id, display_name, role) VALUES
       ($1, 'LINE Customer 1', 'customer'),
       ($2, 'LINE Customer 2', 'customer'),
       ($3, 'LINE Customer 3', 'customer'),
       ($4, 'LINE Customer 4', 'customer'),
       ($5, 'LINE Customer 5', 'customer')
     ON CONFLICT (id) DO NOTHING`,
    [
      SEED_IDS.users.customer1,
      SEED_IDS.users.customer2,
      SEED_IDS.users.customer3,
      SEED_IDS.users.customer4,
      SEED_IDS.users.customer5,
    ]
  );

  // ── LINE accounts ──────────────────────────────────────────────────────────
  const lineAccounts = [
    [SEED_IDS.users.customer1, SEED_IDS.lineUsers.customer1, 'LINE Customer 1'],
    [SEED_IDS.users.customer2, SEED_IDS.lineUsers.customer2, 'LINE Customer 2'],
    [SEED_IDS.users.customer3, SEED_IDS.lineUsers.customer3, 'LINE Customer 3'],
    [SEED_IDS.users.customer4, SEED_IDS.lineUsers.customer4, 'LINE Customer 4'],
    [SEED_IDS.users.customer5, SEED_IDS.lineUsers.customer5, 'LINE Customer 5'],
  ];
  for (const [userId, lineUserId, name] of lineAccounts) {
    await client.query(
      `INSERT INTO line_accounts
         (user_id, line_user_id, display_name, is_linked, last_synced_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (line_user_id) DO NOTHING`,
      [userId, lineUserId, name]
    );
  }

  // ── Counter A: advance the daily_ticket_counter to reflect entries ─────────
  // We'll insert entries with explicit ticket numbers + update the counter once.
  const queueAId = SEED_IDS.queues.counterA;

  // 5 waiting entries (customers 1–5, tickets A-001…A-005)
  const waitingCustomers = [
    SEED_IDS.users.customer1,
    SEED_IDS.users.customer2,
    SEED_IDS.users.customer3,
    SEED_IDS.users.customer4,
    SEED_IDS.users.customer5,
  ] as const;
  const lineIds = [
    SEED_IDS.lineUsers.customer1,
    SEED_IDS.lineUsers.customer2,
    SEED_IDS.lineUsers.customer3,
    SEED_IDS.lineUsers.customer4,
    SEED_IDS.lineUsers.customer5,
  ] as const;

  for (let i = 0; i < 5; i++) {
    const ticket = i + 1;
    await client.query(
      `INSERT INTO queue_entries
         (queue_id, user_id, line_user_id, ticket_number, ticket_display, status)
       VALUES ($1, $2, $3, $4, $5, 'waiting')
       ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
      [queueAId, waitingCustomers[i], lineIds[i], ticket, `A-${String(ticket).padStart(3, '0')}`]
    );
  }

  // 1 called entry (no user — simulates anonymous walk-in)
  await client.query(
    `INSERT INTO queue_entries
       (queue_id, ticket_number, ticket_display, status, called_at)
     VALUES ($1, 6, 'A-006', 'called', NOW() - INTERVAL '3 minutes')
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [queueAId]
  );

  // 1 serving entry (anonymous walk-in)
  await client.query(
    `INSERT INTO queue_entries
       (queue_id, ticket_number, ticket_display, status, called_at, serving_at)
     VALUES ($1, 7, 'A-007', 'serving',
             NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '5 minutes')
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [queueAId]
  );

  // Sync the daily_ticket_counter so the next join gets A-008
  await client.query(`UPDATE queues SET daily_ticket_counter = 7 WHERE id = $1`, [queueAId]);

  // ── VIP Lane: 2 waiting entries ────────────────────────────────────────────
  const vipId = SEED_IDS.queues.vipLane;

  await client.query(
    `INSERT INTO queue_entries
       (queue_id, user_id, line_user_id, ticket_number, ticket_display, status, priority)
     VALUES
       ($1, $2, $3, 1, 'VIP-001', 'waiting', 5),
       ($1, $4, $5, 2, 'VIP-002', 'waiting', 5)
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [
      vipId,
      SEED_IDS.users.customer1,
      SEED_IDS.lineUsers.customer1,
      SEED_IDS.users.customer2,
      SEED_IDS.lineUsers.customer2,
    ]
  );

  await client.query(`UPDATE queues SET daily_ticket_counter = 2 WHERE id = $1`, [vipId]);

  // ── queue_histories: 3 completed trips for analytics ──────────────────────
  await client.query(
    `INSERT INTO queue_histories
       (queue_entry_id, queue_id, organization_id, user_id, line_user_id,
        ticket_number, ticket_display, final_status, skip_count,
        waited_seconds, served_seconds, created_at)
     VALUES
       (NULL, $1, $2, $3, $4, 101, 'A-101', 'completed', 0, 420, 280, NOW() - INTERVAL '2 hours'),
       (NULL, $1, $2, $5, $6, 102, 'A-102', 'completed', 1, 510, 195, NOW() - INTERVAL '1 hour 30 minutes'),
       (NULL, $1, $2, $7, $8, 103, 'A-103', 'no_show',   0, 660,   0, NOW() - INTERVAL '1 hour')`,
    [
      queueAId,
      SEED_IDS.org,
      SEED_IDS.users.customer3,
      SEED_IDS.lineUsers.customer3,
      SEED_IDS.users.customer4,
      SEED_IDS.lineUsers.customer4,
      SEED_IDS.users.customer5,
      SEED_IDS.lineUsers.customer5,
    ]
  );

  // ── notifications: 1 sent (notification display tests) ────────────────────
  await client.query(
    `INSERT INTO notifications
       (user_id, line_user_id, queue_id, type, channel, status,
        payload, sent_at)
     VALUES ($1, $2, $3, 'your_turn', 'line', 'sent',
             '{"message":"It is your turn! Please proceed to Counter A."}',
             NOW() - INTERVAL '5 minutes')`,
    [SEED_IDS.users.customer1, SEED_IDS.lineUsers.customer1, queueAId]
  );

  console.info(
    '[seed] 003 — 5 customers + LINE accounts, 9 queue entries, 3 histories, 1 notification'
  );
}
