import type { PoolClient } from 'pg';

import {
  BRANCHES,
  ORDERS,
  ORG_ID,
  PAYMENT_TRANSACTIONS,
  PRODUCTS,
  QUEUE_ENTRIES,
  QUEUES,
  USERS,
} from './_ids';

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

const paymentTransactionByOrderId = new Map<string, string>([
  [ORDERS.ORDER_1, PAYMENT_TRANSACTIONS.ORDER_1],
  [ORDERS.ORDER_2, PAYMENT_TRANSACTIONS.ORDER_2],
  [ORDERS.ORDER_4, PAYMENT_TRANSACTIONS.ORDER_4],
  [ORDERS.ORDER_6, PAYMENT_TRANSACTIONS.ORDER_6],
  [ORDERS.ORDER_7, PAYMENT_TRANSACTIONS.ORDER_7],
]);

const orders: OrderSeed[] = [
  {
    id: ORDERS.ORDER_1,
    number: 'ORD-0001',
    customerId: USERS.CUSTOMER_1,
    customerName: '山田 太郎',
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
    customerName: '佐藤 花子',
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
    customerName: '鈴木 一郎',
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
    customerName: '高橋 美咲',
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
    customerName: '田中 健太',
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
    customerName: '山田 太郎',
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
    customerName: '佐藤 花子',
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
    customerName: '鈴木 一郎',
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
    `SELECT name, price, service_time_minutes, requires_prepayment
     FROM products
     WHERE id = $1`,
    [productId]
  );
  if (result.rowCount !== 1) throw new Error(`Product not found in seed: ${productId}`);
  return result.rows[0] as {
    name: string;
    price: string;
    service_time_minutes: number;
    requires_prepayment: boolean;
  };
}

export async function seed(client: PoolClient): Promise<void> {
  await client.query(`DELETE FROM queue_histories WHERE metadata @> '{"seed":true}'::jsonb`);
  const seededOrderIds = orders.map((order) => order.id);
  await client.query(
    'DELETE FROM payment_reconciliation_operations WHERE order_id = ANY($1::uuid[])',
    [seededOrderIds]
  );
  await client.query(
    `DELETE FROM payment_webhook_events
     WHERE payment_transaction_id IN (
       SELECT id FROM payment_transactions WHERE order_id = ANY($1::uuid[])
     )`,
    [seededOrderIds]
  );
  await client.query('DELETE FROM payment_transactions WHERE order_id = ANY($1::uuid[])', [
    seededOrderIds,
  ]);

  for (const order of orders) {
    let subtotal = 0;
    const snapshots = [] as Array<{
      productId: string;
      quantity: number;
      name: string;
      price: number;
      serviceTime: number;
      subtotal: number;
      requiresPrepayment: boolean;
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
        requiresPrepayment: product.requires_prepayment,
      });
    }

    const transactionId = paymentTransactionByOrderId.get(order.id) ?? null;
    const refundedAmount = order.paymentStatus === 'refunded' ? subtotal : 0;

    await client.query(
      `
        INSERT INTO orders (
          id, organization_id, branch_id, queue_id, customer_user_id, order_number, customer_name,
          customer_phone, status, subtotal, payment_status, payment_code, notes, refunded_amount,
          organization_name_snapshot, branch_name_snapshot, queue_name_snapshot
        )
        SELECT
          $1, $2, $3, $4, $5, $6, $7, $8, $9::order_status, $10,
          $11::payment_status, $12, $13, $14, organization.name, branch.name, queue.name
        FROM organizations organization
        JOIN organization_branches branch
          ON branch.id = $3 AND branch.organization_id = organization.id
        JOIN queues queue
          ON queue.id = $4
         AND queue.organization_id = organization.id
         AND queue.branch_id = branch.id
        WHERE organization.id = $2
        ON CONFLICT (id) DO UPDATE SET
          branch_id = EXCLUDED.branch_id,
          queue_id = EXCLUDED.queue_id,
          customer_user_id = EXCLUDED.customer_user_id,
          order_number = EXCLUDED.order_number,
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          status = EXCLUDED.status,
          subtotal = EXCLUDED.subtotal,
          payment_status = EXCLUDED.payment_status,
          payment_code = EXCLUDED.payment_code,
          refunded_amount = EXCLUDED.refunded_amount,
          organization_name_snapshot = EXCLUDED.organization_name_snapshot,
          branch_name_snapshot = EXCLUDED.branch_name_snapshot,
          queue_name_snapshot = EXCLUDED.queue_name_snapshot,
          notes = EXCLUDED.notes,
          updated_at = NOW();
      `,
      [
        order.id,
        ORG_ID,
        BRANCHES.TOKYO_MAIN,
        QUEUES.COUNTER_A,
        order.customerId,
        order.number,
        order.customerName,
        order.customerPhone,
        order.status,
        subtotal,
        order.paymentStatus,
        `PAY-${order.number}`,
        'Seed demo order',
        refundedAmount,
      ]
    );

    if (transactionId) {
      await client.query(
        `
          INSERT INTO payment_transactions (
            id, organization_id, order_id, provider, method, payment_intent_id,
            external_transaction_id, status, amount, currency, webhook_status,
            metadata, raw_payload, paid_at, failed_at, refunded_at,
            last_verified_at, refunded_amount
          )
          VALUES (
            $1, $2, $3, 'demo', 'demo_card', $4, $5, $6::payment_status, $7, 'JPY',
            'fixture', jsonb_build_object('scope', 'all_items', 'coveredProductIds', $8::jsonb),
            '{"fixture":true}'::jsonb,
            CASE WHEN $6::payment_status IN ('paid', 'refunded') THEN NOW() - INTERVAL '1 hour' ELSE NULL END,
            CASE WHEN $6::payment_status = 'failed' THEN NOW() - INTERVAL '1 hour' ELSE NULL END,
            CASE WHEN $6::payment_status = 'refunded' THEN NOW() - INTERVAL '30 minutes' ELSE NULL END,
            NOW(), $9
          );
        `,
        [
          transactionId,
          ORG_ID,
          order.id,
          `demo-intent-${order.number}`,
          `demo-transaction-${order.number}`,
          order.paymentStatus,
          subtotal,
          JSON.stringify(snapshots.map((item) => item.productId)),
          refundedAmount,
        ]
      );
    }

    await client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of snapshots) {
      const itemPaymentStatus = order.paymentStatus;
      const prepaidAmount = ['paid', 'refunded'].includes(order.paymentStatus) ? item.subtotal : 0;
      const itemRefundedAmount = order.paymentStatus === 'refunded' ? item.subtotal : 0;
      await client.query(
        `
          INSERT INTO order_items (
            order_id, product_id, product_name, product_price,
            service_time_minutes, quantity, subtotal, payment_status,
            prepaid_amount, refunded_amount, payment_transaction_id,
            requires_prepayment_snapshot
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::payment_status, $9, $10, $11, $12);
        `,
        [
          order.id,
          item.productId,
          item.name,
          item.price,
          item.serviceTime,
          item.quantity,
          item.subtotal,
          itemPaymentStatus,
          prepaidAmount,
          itemRefundedAmount,
          transactionId,
          item.requiresPrepayment,
        ]
      );
    }

    const nowExpr = {
      waiting: {
        created: "NOW() - INTERVAL '10 minutes'",
        called: null,
        serving: null,
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      called: {
        created: "NOW() - INTERVAL '10 minutes'",
        called: "NOW() - INTERVAL '2 minutes'",
        serving: null,
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      serving: {
        created: "NOW() - INTERVAL '15 minutes'",
        called: "NOW() - INTERVAL '8 minutes'",
        serving: "NOW() - INTERVAL '5 minutes'",
        served: null,
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      served: {
        created: "NOW() - INTERVAL '60 minutes'",
        called: "NOW() - INTERVAL '45 minutes'",
        serving: "NOW() - INTERVAL '40 minutes'",
        served: "NOW() - INTERVAL '10 minutes'",
        skipped: null,
        cancelled: null,
        noShow: null,
      },
      skipped: {
        created: "NOW() - INTERVAL '40 minutes'",
        called: "NOW() - INTERVAL '30 minutes'",
        serving: null,
        served: null,
        skipped: "NOW() - INTERVAL '20 minutes'",
        cancelled: null,
        noShow: null,
      },
      cancelled: {
        created: "NOW() - INTERVAL '20 minutes'",
        called: null,
        serving: null,
        served: null,
        skipped: null,
        cancelled: "NOW() - INTERVAL '15 minutes'",
        noShow: null,
      },
      no_show: {
        created: "NOW() - INTERVAL '30 minutes'",
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
          called_at, serving_started_at, served_at, skipped_at, cancelled_at, no_show_at,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          (NOW() AT TIME ZONE 'Asia/Tokyo')::date, $8::queue_entry_status, 0, $9, $10,
          ${nowExpr.called ?? 'NULL'}, ${nowExpr.serving ?? 'NULL'}, ${nowExpr.served ?? 'NULL'},
          ${nowExpr.skipped ?? 'NULL'}, ${nowExpr.cancelled ?? 'NULL'}, ${nowExpr.noShow ?? 'NULL'},
          ${nowExpr.created}
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          order_id = EXCLUDED.order_id,
          line_user_id = EXCLUDED.line_user_id,
          ticket_number = EXCLUDED.ticket_number,
          ticket_code = EXCLUDED.ticket_code,
          business_date = EXCLUDED.business_date,
          status = EXCLUDED.status,
          position_snapshot = EXCLUDED.position_snapshot,
          estimated_wait_seconds = EXCLUDED.estimated_wait_seconds,
          called_at = EXCLUDED.called_at,
          serving_started_at = EXCLUDED.serving_started_at,
          served_at = EXCLUDED.served_at,
          skipped_at = EXCLUDED.skipped_at,
          cancelled_at = EXCLUDED.cancelled_at,
          no_show_at = EXCLUDED.no_show_at,
          created_at = EXCLUDED.created_at,
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
    `UPDATE queues q
     SET daily_ticket_counter = GREATEST(
           q.daily_ticket_counter,
           COALESCE((
             SELECT MAX(qe.ticket_number)
             FROM queue_entries qe
             WHERE qe.queue_id = q.id
               AND qe.business_date = (NOW() AT TIME ZONE o.timezone)::date
           ), 0)
         ),
         counter_business_date = (NOW() AT TIME ZONE o.timezone)::date,
         updated_at = NOW()
     FROM organizations o
     WHERE q.organization_id = o.id AND q.organization_id = $1`,
    [ORG_ID]
  );
  await client.query(
    `INSERT INTO organization_counters (organization_id, next_order_number)
     SELECT $1,
            COALESCE(MAX(SUBSTRING(order_number FROM '([0-9]+)$')::BIGINT), 0) + 1
     FROM orders
     WHERE organization_id = $1
     ON CONFLICT (organization_id) DO UPDATE SET
       next_order_number = GREATEST(
         organization_counters.next_order_number,
         EXCLUDED.next_order_number
       ),
       updated_at = NOW()`,
    [ORG_ID]
  );
}
