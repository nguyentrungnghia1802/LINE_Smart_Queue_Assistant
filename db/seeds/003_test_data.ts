import { type Client } from 'pg';

import { SEED_IDS } from './_ids';

/**
 * Seed 003 — Demo queue entries, orders, notifications, penalties, audit logs.
 *
 * Counter A queue_entries:
 *   A001 … A005  waiting   (customers 1–5, with orders)
 *   A006          called    (with order)
 *   A007          serving   (with order)
 *
 * VIP Lane:
 *   VIP001, VIP002  waiting
 */
export async function seed003TestData(client: Client): Promise<void> {
  // ── Customer users ───────────────────────────────────────────────────────────
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

  // ── LINE accounts ────────────────────────────────────────────────────────────
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

  // ── Orders (created BEFORE queue_entries so order_id FK works) ───────────────
  const orderData = [
    {
      orderId: '66666666-0001-4666-8666-666666666661',
      userId: SEED_IDS.users.customer1,
      num: 'A001',
      customer: 'Nguyễn Văn An',
      productId: SEED_IDS.products.haircut,
      qty: 1,
      price: 120000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666662',
      userId: SEED_IDS.users.customer2,
      num: 'A002',
      customer: 'Trần Thị Bích',
      productId: SEED_IDS.products.dyeHair,
      qty: 1,
      price: 350000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666663',
      userId: SEED_IDS.users.customer3,
      num: 'A003',
      customer: 'Lê Minh Cường',
      productId: SEED_IDS.products.haircut,
      qty: 1,
      price: 120000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666664',
      userId: SEED_IDS.users.customer4,
      num: 'A004',
      customer: 'Phạm Thu Dung',
      productId: SEED_IDS.products.perm,
      qty: 1,
      price: 450000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666665',
      userId: SEED_IDS.users.customer5,
      num: 'A005',
      customer: 'Hoàng Văn Em',
      productId: SEED_IDS.products.hairMask,
      qty: 1,
      price: 180000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666666',
      userId: null,
      num: 'A006',
      customer: 'Guest 6',
      productId: SEED_IDS.products.haircut,
      qty: 1,
      price: 120000,
    },
    {
      orderId: '66666666-0001-4666-8666-666666666667',
      userId: null,
      num: 'A007',
      customer: 'Guest 7',
      productId: SEED_IDS.products.conditioner,
      qty: 2,
      price: 95000,
    },
  ];
  for (const o of orderData) {
    await client.query(
      `INSERT INTO orders (id, organization_id, customer_user_id, order_number, customer_name, status, subtotal, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, 'unpaid')
       ON CONFLICT (id) DO NOTHING`,
      [o.orderId, SEED_IDS.org, o.userId, o.num, o.customer, o.price * o.qty]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
       SELECT $1, $2, p.name, p.price, p.service_time_minutes, $3, p.price * $3
       FROM products p WHERE p.id = $2
       ON CONFLICT DO NOTHING`,
      [o.orderId, o.productId, o.qty]
    );
  }

  // ── Queue entries (Counter A) ─────────────────────────────────────────────────
  const queueAId = SEED_IDS.queues.counterA;
  const waitingData = [
    [
      '55555555-5555-4555-8555-555555555551',
      SEED_IDS.users.customer1,
      SEED_IDS.lineUsers.customer1,
      1,
      'A001',
      '66666666-0001-4666-8666-666666666661',
      'waiting',
      null,
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555552',
      SEED_IDS.users.customer2,
      SEED_IDS.lineUsers.customer2,
      2,
      'A002',
      '66666666-0001-4666-8666-666666666662',
      'waiting',
      null,
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555553',
      SEED_IDS.users.customer3,
      SEED_IDS.lineUsers.customer3,
      3,
      'A003',
      '66666666-0001-4666-8666-666666666663',
      'waiting',
      null,
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555554',
      SEED_IDS.users.customer4,
      SEED_IDS.lineUsers.customer4,
      4,
      'A004',
      '66666666-0001-4666-8666-666666666664',
      'waiting',
      null,
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555555',
      SEED_IDS.users.customer5,
      SEED_IDS.lineUsers.customer5,
      5,
      'A005',
      '66666666-0001-4666-8666-666666666665',
      'waiting',
      null,
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555556',
      null,
      null,
      6,
      'A006',
      '66666666-0001-4666-8666-666666666666',
      'called',
      "NOW() - INTERVAL '5 minutes'",
      null,
    ],
    [
      '55555555-5555-4555-8555-555555555557',
      null,
      null,
      7,
      'A007',
      '66666666-0001-4666-8666-666666666667',
      'serving',
      "NOW() - INTERVAL '10 minutes'",
      "NOW() - INTERVAL '3 minutes'",
    ],
  ];

  for (const [
    entryId,
    userId,
    lineUserId,
    num,
    code,
    orderId,
    status,
    calledAt,
    servingAt,
  ] of waitingData) {
    await client.query(
      `INSERT INTO queue_entries
         (id, queue_id, user_id, order_id, line_user_id, ticket_number, ticket_code, status, priority,
          called_at, serving_started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, ${calledAt ? (calledAt as string) : 'NULL'}, ${servingAt ? (servingAt as string) : 'NULL'})
       ON CONFLICT (id) DO NOTHING`,
      [entryId, queueAId, userId, orderId, lineUserId, num, code, status]
    );
    // Link order back to queue entry
    await client.query(`UPDATE orders SET queue_entry_id = $1 WHERE id = $2`, [entryId, orderId]);
  }

  // Update queue counter to reflect seeded entries
  await client.query(`UPDATE queues SET daily_ticket_counter = 7 WHERE id = $1`, [queueAId]);

  // ── VIP queue entries ────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO queue_entries
       (id, queue_id, user_id, ticket_number, ticket_code, status, priority)
     VALUES
       ('55555555-5555-4555-8555-555555555561', $1, $2, 1, 'VIP001', 'waiting', 5),
       ('55555555-5555-4555-8555-555555555562', $1, $3, 2, 'VIP002', 'waiting', 5)
     ON CONFLICT (id) DO NOTHING`,
    [SEED_IDS.queues.vipLane, SEED_IDS.users.customer1, SEED_IDS.users.customer2]
  );
  await client.query(`UPDATE queues SET daily_ticket_counter = 2 WHERE id = $1`, [
    SEED_IDS.queues.vipLane,
  ]);

  // ── Penalty records ───────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO penalty_records (organization_id, queue_id, user_id, penalty_type, points, reason)
     VALUES ($1, $2, $3, 'no_show', 2, 'Auto-generated demo penalty')
     ON CONFLICT DO NOTHING`,
    [SEED_IDS.org, SEED_IDS.queues.counterA, SEED_IDS.users.customer4]
  );

  // ── Audit logs ────────────────────────────────────────────────────────────────
  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_type, action, resource_type, resource_id, organization_id)
     VALUES
       ($1, 'user', 'queue.create', 'queue', $3, $2),
       ($1, 'user', 'product.create', 'product', $4, $2)`,
    [SEED_IDS.users.manager, SEED_IDS.org, SEED_IDS.queues.counterA, SEED_IDS.products.haircut]
  );

  console.info('[seed] 003 — demo queue entries, orders, penalties, audit logs created');
}
