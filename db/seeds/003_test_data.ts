import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 003 — Demo queue entries and sample orders for Staff Dashboard.
 *
 * Counter A  (queue_id: counterA):
 *   A-001 … A-005  waiting   (customers 1–5, with orders)
 *   A-006          called    (anonymous, with order)
 *   A-007          serving   (anonymous, with order)
 *
 * VIP Lane (queue_id: vipLane):
 *   VIP-001, VIP-002  waiting
 *
 * Orders:  A-006 and A-007 entries have orders with items
 */
export async function seed003TestData(client: Client): Promise<void> {
  // ── Customer users ─────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO users (id, display_name, role) VALUES
       ($1, 'Nguyễn Văn An', 'customer'),
       ($2, 'Trần Thị Bích', 'customer'),
       ($3, 'Lê Minh Cường', 'customer'),
       ($4, 'Phạm Thu Dung', 'customer'),
       ($5, 'Hoàng Văn Em',  'customer')
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
    [SEED_IDS.users.customer1, SEED_IDS.lineUsers.customer1, 'Nguyễn Văn An'],
    [SEED_IDS.users.customer2, SEED_IDS.lineUsers.customer2, 'Trần Thị Bích'],
    [SEED_IDS.users.customer3, SEED_IDS.lineUsers.customer3, 'Lê Minh Cường'],
    [SEED_IDS.users.customer4, SEED_IDS.lineUsers.customer4, 'Phạm Thu Dung'],
    [SEED_IDS.users.customer5, SEED_IDS.lineUsers.customer5, 'Hoàng Văn Em'],
  ];
  for (const [userId, lineUserId, name] of lineAccounts) {
    await client.query(
      `INSERT INTO line_accounts (user_id, line_user_id, display_name, is_linked, last_synced_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (line_user_id) DO NOTHING`,
      [userId, lineUserId, name]
    );
  }

  // ── Counter A queue entries ────────────────────────────────────────────────
  const queueAId = SEED_IDS.queues.counterA;

  // IDs for queue entries we need to reference for orders
  const entryIds = {
    a001: '55555555-5555-4555-8555-555555555551',
    a002: '55555555-5555-4555-8555-555555555552',
    a003: '55555555-5555-4555-8555-555555555553',
    a004: '55555555-5555-4555-8555-555555555554',
    a005: '55555555-5555-4555-8555-555555555555',
    a006: '55555555-5555-4555-8555-555555555556',
    a007: '55555555-5555-4555-8555-555555555557',
    vip001: '55555555-5555-4555-8555-555555555561',
    vip002: '55555555-5555-4555-8555-555555555562',
  };

  // 5 waiting entries (customers 1–5)
  const waitingData = [
    [entryIds.a001, SEED_IDS.users.customer1, SEED_IDS.lineUsers.customer1, 1, 'A-001'],
    [entryIds.a002, SEED_IDS.users.customer2, SEED_IDS.lineUsers.customer2, 2, 'A-002'],
    [entryIds.a003, SEED_IDS.users.customer3, SEED_IDS.lineUsers.customer3, 3, 'A-003'],
    [entryIds.a004, SEED_IDS.users.customer4, SEED_IDS.lineUsers.customer4, 4, 'A-004'],
    [entryIds.a005, SEED_IDS.users.customer5, SEED_IDS.lineUsers.customer5, 5, 'A-005'],
  ];
  for (const [id, userId, lineUserId, num, display] of waitingData) {
    await client.query(
      `INSERT INTO queue_entries
         (id, queue_id, user_id, line_user_id, ticket_number, ticket_display, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
       ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
      [id, queueAId, userId, lineUserId, num, display]
    );
  }

  // 1 called entry (anonymous)
  await client.query(
    `INSERT INTO queue_entries
       (id, queue_id, ticket_number, ticket_display, status, called_at)
     VALUES ($1, $2, 6, 'A-006', 'called', NOW() - INTERVAL '3 minutes')
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [entryIds.a006, queueAId]
  );

  // 1 serving entry (anonymous)
  await client.query(
    `INSERT INTO queue_entries
       (id, queue_id, ticket_number, ticket_display, status, called_at, serving_at)
     VALUES ($1, $2, 7, 'A-007', 'serving',
             NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '5 minutes')
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [entryIds.a007, queueAId]
  );

  await client.query(`UPDATE queues SET daily_ticket_counter = 7 WHERE id = $1`, [queueAId]);

  // ── VIP Lane ──────────────────────────────────────────────────────────────
  const vipId = SEED_IDS.queues.vipLane;
  await client.query(
    `INSERT INTO queue_entries
       (id, queue_id, user_id, line_user_id, ticket_number, ticket_display, status, priority)
     VALUES ($1, $2, $3, $4, 1, 'VIP-001', 'waiting', 5)
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [entryIds.vip001, vipId, SEED_IDS.users.customer1, SEED_IDS.lineUsers.customer1]
  );
  await client.query(
    `INSERT INTO queue_entries
       (id, queue_id, user_id, line_user_id, ticket_number, ticket_display, status, priority)
     VALUES ($1, $2, $3, $4, 2, 'VIP-002', 'waiting', 5)
     ON CONFLICT (queue_id, ticket_number) DO NOTHING`,
    [entryIds.vip002, vipId, SEED_IDS.users.customer2, SEED_IDS.lineUsers.customer2]
  );
  await client.query(`UPDATE queues SET daily_ticket_counter = 2 WHERE id = $1`, [vipId]);

  // ── Sample orders linked to called/serving entries ────────────────────────
  const orderIds = {
    called: '66666666-6666-4666-8666-666666666661',
    serving: '66666666-6666-4666-8666-666666666662',
    w001: '66666666-6666-4666-8666-666666666663',
    w002: '66666666-6666-4666-8666-666666666664',
  };

  await client.query(
    `DELETE FROM order_items
     WHERE order_id = ANY($1::uuid[])`,
    [[orderIds.called, orderIds.serving, orderIds.w001, orderIds.w002]]
  );

  // Order for A-007 (serving) — haircut + shampoo
  await client.query(
    `INSERT INTO orders
       (id, organization_id, queue_entry_id, order_number, customer_name, customer_phone,
        subtotal, status, payment_status)
     VALUES ($1, $2, $3, 'A007', 'Khách lẻ (serving)', '0901111111',
             205000, 'processing', 'paid')
     ON CONFLICT (id) DO NOTHING`,
    [orderIds.serving, SEED_IDS.org, entryIds.a007]
  );
  await client.query(
    `INSERT INTO order_items
       (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
     VALUES
       ($1, $2, 'Cắt tóc nam', 120000, 30, 1, 120000),
       ($1, $3, 'Dầu gội đầu',  85000,  5, 1,  85000)
     ON CONFLICT DO NOTHING`,
    [orderIds.serving, SEED_IDS.products.haircut, SEED_IDS.products.shampoo]
  );

  // Order for A-006 (called) — hair dye (requires prepayment)
  await client.query(
    `INSERT INTO orders
       (id, organization_id, queue_entry_id, order_number, customer_name, customer_phone,
        subtotal, status, payment_status)
     VALUES ($1, $2, $3, 'A006', 'Trần Thị Hương', '0909222222',
             350000, 'pending', 'paid')
     ON CONFLICT (id) DO NOTHING`,
    [orderIds.called, SEED_IDS.org, entryIds.a006]
  );
  await client.query(
    `INSERT INTO order_items
       (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
     VALUES ($1, $2, 'Nhuộm tóc', 350000, 120, 1, 350000)
     ON CONFLICT DO NOTHING`,
    [orderIds.called, SEED_IDS.products.dyeHair]
  );

  // Order for A-001 (waiting) — haircut
  await client.query(
    `INSERT INTO orders
       (id, organization_id, queue_entry_id, order_number, customer_name,
        subtotal, status, payment_status)
     VALUES ($1, $2, $3, 'A001', 'Nguyễn Văn An',
             120000, 'pending', 'unpaid')
     ON CONFLICT (id) DO NOTHING`,
    [orderIds.w001, SEED_IDS.org, entryIds.a001]
  );
  await client.query(
    `INSERT INTO order_items
       (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
     VALUES ($1, $2, 'Cắt tóc nam', 120000, 30, 1, 120000)
     ON CONFLICT DO NOTHING`,
    [orderIds.w001, SEED_IDS.products.haircut]
  );

  // Order for A-002 (waiting) — haircut + conditioner
  await client.query(
    `INSERT INTO orders
       (id, organization_id, queue_entry_id, order_number, customer_name,
        subtotal, status, payment_status)
     VALUES ($1, $2, $3, 'A002', 'Trần Thị Bích',
             215000, 'pending', 'unpaid')
     ON CONFLICT (id) DO NOTHING`,
    [orderIds.w002, SEED_IDS.org, entryIds.a002]
  );
  await client.query(
    `INSERT INTO order_items
       (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
     VALUES
       ($1, $2, 'Cắt tóc nam', 120000, 30, 1, 120000),
       ($1, $3, 'Dầu xả tóc',   95000,  5, 1,  95000)
     ON CONFLICT DO NOTHING`,
    [orderIds.w002, SEED_IDS.products.haircut, SEED_IDS.products.conditioner]
  );

  // ── queue_histories ───────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO queue_histories
       (queue_entry_id, queue_id, organization_id, user_id, line_user_id,
        ticket_number, ticket_display, final_status, skip_count,
        waited_seconds, served_seconds, created_at)
     VALUES
       (NULL, $1, $2, $3, $4, 101, 'A-101', 'completed', 0, 420, 280, NOW() - INTERVAL '2 hours'),
       (NULL, $1, $2, $5, $6, 102, 'A-102', 'completed', 1, 510, 195, NOW() - INTERVAL '90 minutes'),
       (NULL, $1, $2, $7, $8, 103, 'A-103', 'no_show',   0, 660,   0, NOW() - INTERVAL '60 minutes')
     ON CONFLICT DO NOTHING`,
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

  console.info('[seed] 003 — 5 customers, 9 queue entries, 4 sample orders with items');
}
