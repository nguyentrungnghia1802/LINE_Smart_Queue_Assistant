import type { PoolClient } from 'pg';

import { ORDERS, ORG_ID, PRODUCTS, QUEUE_ENTRIES, QUEUES, USERS } from './_ids';

type OrderSeed = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'failed';
  entryId: string;
  ticketNumber: number;
  ticketCode: string;
  entryStatus: 'waiting' | 'called' | 'serving' | 'served' | 'skipped' | 'cancelled' | 'no_show';
  productItems: Array<[string, number]>;
};

const orders: OrderSeed[] = [
  {
    id: ORDERS.ORDER_1,
    number: 'ORD-0001',
    customerId: USERS.CUSTOMER_1,
    customerName: 'Customer Demo',
    customerPhone: '0900000031',
    status: 'completed',
    paymentStatus: 'paid',
    entryId: QUEUE_ENTRIES.ENTRY_1,
    ticketNumber: 1,
    ticketCode: 'A001',
    entryStatus: 'served',
    productItems: [[PRODUCTS.HAIRCUT, 1]],
  },
  {
    id: ORDERS.ORDER_2,
    number: 'ORD-0002',
    customerId: USERS.CUSTOMER_2,
    customerName: 'Customer Two',
    customerPhone: '0900000032',
    status: 'pending',
    paymentStatus: 'paid',
    entryId: QUEUE_ENTRIES.ENTRY_2,
    ticketNumber: 2,
    ticketCode: 'A002',
    entryStatus: 'waiting',
    productItems: [[PRODUCTS.HAIR_DYE, 1]],
  },
  {
    id: ORDERS.ORDER_3,
    number: 'ORD-0003',
    customerId: USERS.CUSTOMER_3,
    customerName: 'Customer Three',
    customerPhone: '0900000033',
    status: 'processing',
    paymentStatus: 'unpaid',
    entryId: QUEUE_ENTRIES.ENTRY_3,
    ticketNumber: 3,
    ticketCode: 'A003',
    entryStatus: 'called',
    productItems: [
      [PRODUCTS.HAIR_WASH, 1],
      [PRODUCTS.PEACH_TEA, 2],
    ],
  },
  {
    id: ORDERS.ORDER_4,
    number: 'ORD-0004',
    customerId: USERS.CUSTOMER_4,
    customerName: 'Customer Four',
    customerPhone: '0900000034',
    status: 'processing',
    paymentStatus: 'paid',
    entryId: QUEUE_ENTRIES.ENTRY_4,
    ticketNumber: 4,
    ticketCode: 'A004',
    entryStatus: 'serving',
    productItems: [[PRODUCTS.CHECKUP, 1]],
  },
  {
    id: ORDERS.ORDER_5,
    number: 'ORD-0005',
    customerId: USERS.CUSTOMER_5,
    customerName: 'Customer Five',
    customerPhone: '0900000035',
    status: 'pending',
    paymentStatus: 'unpaid',
    entryId: QUEUE_ENTRIES.ENTRY_5,
    ticketNumber: 5,
    ticketCode: 'A005',
    entryStatus: 'waiting',
    productItems: [
      [PRODUCTS.BUN_BO, 1],
      [PRODUCTS.WATER, 2],
    ],
  },
  {
    id: ORDERS.ORDER_6,
    number: 'ORD-0006',
    customerId: USERS.CUSTOMER_1,
    customerName: 'Customer Demo',
    customerPhone: '0900000031',
    status: 'cancelled',
    paymentStatus: 'refunded',
    entryId: QUEUE_ENTRIES.ENTRY_6,
    ticketNumber: 6,
    ticketCode: 'A006',
    entryStatus: 'cancelled',
    productItems: [
      [PRODUCTS.HAIRCUT, 1],
      [PRODUCTS.HAIR_WASH, 1],
    ],
  },
  {
    id: ORDERS.ORDER_7,
    number: 'ORD-0007',
    customerId: USERS.CUSTOMER_2,
    customerName: 'Customer Two',
    customerPhone: '0900000032',
    status: 'cancelled',
    paymentStatus: 'failed',
    entryId: QUEUE_ENTRIES.ENTRY_7,
    ticketNumber: 7,
    ticketCode: 'A007',
    entryStatus: 'no_show',
    productItems: [[PRODUCTS.CHECKUP, 1]],
  },
  {
    id: ORDERS.ORDER_8,
    number: 'ORD-0008',
    customerId: USERS.CUSTOMER_3,
    customerName: 'Customer Three',
    customerPhone: '0900000033',
    status: 'pending',
    paymentStatus: 'unpaid',
    entryId: QUEUE_ENTRIES.ENTRY_8,
    ticketNumber: 8,
    ticketCode: 'A008',
    entryStatus: 'waiting',
    productItems: [
      [PRODUCTS.PEACH_TEA, 1],
      [PRODUCTS.WATER, 1],
    ],
  },
];

async function getProductSnapshot(client: PoolClient, productId: string) {
  const result = await client.query(
    `SELECT name, price, service_time_minutes FROM products WHERE id = $1`,
    [productId]
  );
  if (result.rowCount !== 1) throw new Error(`Product not found in seed: ${productId}`);
  return result.rows[0] as { name: string; price: string; service_time_minutes: number };
}

export async function seed(client: PoolClient): Promise<void> {
  for (const order of orders) {
    let subtotal = 0;
    const snapshots = [] as Array<{
      productId: string;
      quantity: number;
      name: string;
      price: number;
      serviceTime: number;
      subtotal: number;
    }>;

    for (const [productId, quantity] of order.productItems) {
      const product = await getProductSnapshot(client, productId);
      const price = Number(product.price);
      const itemSubtotal = price * quantity;
      subtotal += itemSubtotal;
      snapshots.push({
        productId,
        quantity,
        name: product.name,
        price,
        serviceTime: product.service_time_minutes,
        subtotal: itemSubtotal,
      });
    }

    await client.query(
      `
        INSERT INTO orders (
          id, organization_id, customer_user_id, order_number, customer_name,
          customer_phone, status, subtotal, payment_status, payment_code, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::order_status, $8, $9::payment_status, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          customer_user_id = EXCLUDED.customer_user_id,
          order_number = EXCLUDED.order_number,
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          status = EXCLUDED.status,
          subtotal = EXCLUDED.subtotal,
          payment_status = EXCLUDED.payment_status,
          payment_code = EXCLUDED.payment_code,
          notes = EXCLUDED.notes,
          updated_at = NOW();
      `,
      [
        order.id,
        ORG_ID,
        order.customerId,
        order.number,
        order.customerName,
        order.customerPhone,
        order.status,
        subtotal,
        order.paymentStatus,
        `PAY-${order.number}`,
        'Seed demo order',
      ]
    );

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of snapshots) {
      await client.query(
        `
          INSERT INTO order_items (
            order_id, product_id, product_name, product_price,
            service_time_minutes, quantity, subtotal
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `,
        [
          order.id,
          item.productId,
          item.name,
          item.price,
          item.serviceTime,
          item.quantity,
          item.subtotal,
        ]
      );
    }

    const nowExpr = {
      waiting: {
        called: null,
        serving: null,
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      called: {
        called: "NOW() - INTERVAL '2 minutes'",
        serving: null,
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      serving: {
        called: "NOW() - INTERVAL '8 minutes'",
        serving: "NOW() - INTERVAL '5 minutes'",
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      served: {
        called: "NOW() - INTERVAL '45 minutes'",
        serving: "NOW() - INTERVAL '40 minutes'",
        served: "NOW() - INTERVAL '10 minutes'",
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      skipped: {
        called: "NOW() - INTERVAL '30 minutes'",
        serving: null,
        served: null,
        skipped: "NOW() - INTERVAL '20 minutes'",
        cancelled: null,
        noShow: null,
      },
      cancelled: {
        called: null,
        serving: null,
        served: null,
        skipped: null,
        cancelled: "NOW() - INTERVAL '15 minutes'",
        noShow: null,
      },
      no_show: {
        called: "NOW() - INTERVAL '25 minutes'",
        serving: null,
        served: null,
        skipped: null,
        cancelled: null,
        noShow: "NOW() - INTERVAL '10 minutes'",
      },
    }[order.entryStatus];

    await client.query(
      `
        INSERT INTO queue_entries (
          id, queue_id, user_id, order_id, line_user_id, ticket_number, ticket_code,
          business_date, status, priority, position_snapshot, estimated_wait_seconds,
          called_at, serving_started_at, served_at, skipped_at, cancelled_at, no_show_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          (NOW() AT TIME ZONE 'Asia/Tokyo')::date, $8::queue_entry_status, 0, $9, $10,
          ${nowExpr.called ?? 'NULL'}, ${nowExpr.serving ?? 'NULL'}, ${nowExpr.served ?? 'NULL'},
          ${nowExpr.skipped ?? 'NULL'}, ${nowExpr.cancelled ?? 'NULL'}, ${nowExpr.noShow ?? 'NULL'}
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          order_id = EXCLUDED.order_id,
          line_user_id = EXCLUDED.line_user_id,
          ticket_number = EXCLUDED.ticket_number,
          ticket_code = EXCLUDED.ticket_code,
          status = EXCLUDED.status,
          position_snapshot = EXCLUDED.position_snapshot,
          estimated_wait_seconds = EXCLUDED.estimated_wait_seconds,
          called_at = EXCLUDED.called_at,
          serving_started_at = EXCLUDED.serving_started_at,
          served_at = EXCLUDED.served_at,
          skipped_at = EXCLUDED.skipped_at,
          cancelled_at = EXCLUDED.cancelled_at,
          no_show_at = EXCLUDED.no_show_at,
          updated_at = NOW();
      `,
      [
        order.entryId,
        QUEUES.COUNTER_A,
        order.customerId,
        order.id,
        `UdemoCustomer${order.ticketNumber <= 5 ? order.ticketNumber : (order.ticketNumber % 5) + 1}`,
        order.ticketNumber,
        order.ticketCode,
        order.entryStatus,
        Math.max(order.ticketNumber - 1, 0),
        Math.max(order.ticketNumber - 1, 0) * 900,
      ]
    );

    await client.query(
      `
        INSERT INTO queue_histories (
          organization_id, queue_id, queue_entry_id, actor_id, line_user_id,
          ticket_number, ticket_code, from_status, to_status, reason,
          wait_seconds, service_seconds, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::queue_entry_status, $9, $10, $11, '{"seed":true}'::jsonb);
      `,
      [
        ORG_ID,
        QUEUES.COUNTER_A,
        order.entryId,
        order.customerId,
        `UdemoCustomer${order.ticketNumber <= 5 ? order.ticketNumber : (order.ticketNumber % 5) + 1}`,
        order.ticketNumber,
        order.ticketCode,
        order.entryStatus,
        'Seed initial status',
        order.entryStatus === 'waiting' ? null : 600,
        order.entryStatus === 'served' ? 1800 : null,
      ]
    );
  }

  await client.query(
    `UPDATE queues SET daily_ticket_counter = 8, updated_at = NOW() WHERE id = $1`,
    [QUEUES.COUNTER_A]
  );
}
