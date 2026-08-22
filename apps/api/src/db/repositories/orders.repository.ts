import { PoolClient } from 'pg';

import { pool } from '../client';

import type { QueueEntryRow } from './queue-entries.repository';

export interface OrderRow {
  id: string;
  organization_id: string;
  branch_id: string;
  queue_id: string;
  queue_entry_id: string | null;
  order_number: string;
  booking_group_id?: string | null;
  customer_name: string | null;
  customer_user_id: string | null;
  customer_phone: string | null;
  status: string;
  subtotal: string;
  payment_status: string;
  refunded_amount?: string;
  payment_code: string | null;
  notes: string | null;
  organization_name_snapshot: string;
  branch_name_snapshot: string;
  queue_name_snapshot: string;
  fulfilled_by_user_id: string | null;
  fulfilled_by_name: string | null;
  fulfilled_by_employee_code: string | null;
  fulfilled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Enriched fields from queue_entries join (present in some queries)
  ticket_code?: string | null;
  queue_entry_status?: string | null;
  customer_line_display_name?: string | null;
}

export interface CustomerLocationRow {
  id: string;
  organization_id: string;
  queue_entry_id: string | null;
  customer_user_id: string | null;
  local_device_key: string | null;
  latitude: string | null;
  longitude: string | null;
  accuracy_meters: number | null;
  distance_to_org_meters: number | null;
  captured_at: Date;
}

export interface LocationAlertRow {
  id: string;
  organization_id: string;
  queue_entry_id: string | null;
  customer_location_id: string | null;
  alert_type: string;
  status: string;
  distance_to_org_meters: number | null;
  threshold_meters: number;
  due_at: Date | null;
  sent_at: Date | null;
  raw_payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image_url?: string | null;
  product_price: string;
  service_time_minutes: number;
  quantity: number;
  subtotal: string;
  payment_status?: string;
  prepaid_amount?: string;
  refunded_amount?: string;
  payment_transaction_id?: string | null;
  requires_prepayment_snapshot?: boolean;
  created_at: Date;
}

export interface PaymentTransactionRow {
  id: string;
  organization_id: string;
  order_id: string | null;
  provider: string;
  method: string;
  payment_intent_id?: string | null;
  external_transaction_id: string | null;
  status: string;
  amount: string;
  currency: string;
  redirect_url: string | null;
  checkout_url?: string | null;
  return_url?: string | null;
  metadata?: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  authorized_at?: Date | null;
  paid_at: Date | null;
  failed_at?: Date | null;
  cancelled_at?: Date | null;
  refunded_at: Date | null;
  refunded_amount?: string;
  last_provider_event_at?: Date | null;
  last_verified_at?: Date | null;
  last_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderWithItems extends OrderRow {
  items: OrderItemRow[];
}

export interface ActiveOrderInQueue {
  order: OrderRow;
  entry: QueueEntryRow;
}

export const ordersRepository = {
  async nextOrderNumber(organizationId: string, client: PoolClient): Promise<number> {
    const { rows } = await client.query<{ value: string }>(
      `INSERT INTO organization_counters (organization_id, next_order_number)
       VALUES ($1, 2)
       ON CONFLICT (organization_id) DO UPDATE
       SET next_order_number = organization_counters.next_order_number + 1,
           updated_at = NOW()
       RETURNING (next_order_number - 1)::text AS value`,
      [organizationId]
    );
    return Number(rows[0].value);
  },

  async findByOrg(orgId: string, status?: string, branchId?: string): Promise<OrderWithItems[]> {
    const statusClause = status ? `AND o.status = $3` : '';
    const params: unknown[] = [orgId, branchId ?? null, ...(status ? [status] : [])];
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         qe.id AS queue_entry_id,
         qe.ticket_code,
         qe.status AS queue_entry_status,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_image_url', p.image_url,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'payment_status', oi.payment_status,
               'prepaid_amount', oi.prepaid_amount,
               'refunded_amount', oi.refunded_amount,
               'payment_transaction_id', oi.payment_transaction_id,
               'requires_prepayment_snapshot', oi.requires_prepayment_snapshot,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN queue_entries qe ON qe.order_id = o.id
       LEFT JOIN queues q ON q.id = qe.queue_id
       WHERE o.organization_id = $1
         AND ($2::uuid IS NULL OR q.branch_id = $2)
         ${statusClause}
       GROUP BY o.id, qe.id, qe.ticket_code, qe.status
       ORDER BY o.created_at DESC`,
      params
    );
    return rows.map((r) => ({ ...r, items: r.items_json as unknown as OrderItemRow[] }));
  },

  async findById(id: string): Promise<OrderWithItems | null> {
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         qe.id AS queue_entry_id,
         la.display_name AS customer_line_display_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_image_url', p.image_url,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'payment_status', oi.payment_status,
               'prepaid_amount', oi.prepaid_amount,
               'refunded_amount', oi.refunded_amount,
               'payment_transaction_id', oi.payment_transaction_id,
               'requires_prepayment_snapshot', oi.requires_prepayment_snapshot,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN queue_entries qe ON qe.order_id = o.id
       LEFT JOIN line_accounts la ON la.user_id = o.customer_user_id
       WHERE o.id = $1
       GROUP BY o.id, qe.id, la.display_name`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: r.items_json as unknown as OrderItemRow[] };
  },

  async findBranchIdForOrder(id: string): Promise<string | null> {
    const { rows } = await pool.query<{ branch_id: string }>(
      `SELECT q.branch_id
       FROM queue_entries qe
       JOIN queues q ON q.id = qe.queue_id
       WHERE qe.order_id = $1`,
      [id]
    );
    return rows[0]?.branch_id ?? null;
  },

  /**
   * Find an order with its items by queue entry ID.
   * Single JOIN query — eliminates the N+1 that existed when doing
   * SELECT * followed by findById(id).
   */
  async findByQueueEntry(queueEntryId: string): Promise<OrderWithItems | null> {
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         qe.id AS queue_entry_id,
         la.display_name AS customer_line_display_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_image_url', p.image_url,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'payment_status', oi.payment_status,
               'prepaid_amount', oi.prepaid_amount,
               'refunded_amount', oi.refunded_amount,
               'payment_transaction_id', oi.payment_transaction_id,
               'requires_prepayment_snapshot', oi.requires_prepayment_snapshot,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       JOIN queue_entries qe ON qe.order_id = o.id
       LEFT JOIN line_accounts la ON la.user_id = o.customer_user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE qe.id = $1
       GROUP BY o.id, qe.id, la.display_name
       LIMIT 1`,
      [queueEntryId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: r.items_json as unknown as OrderItemRow[] };
  },

  async findOrderNumberByQueueEntry(
    queueEntryId: string,
    orderId?: string | null,
    client?: PoolClient
  ): Promise<string | null> {
    const executor = client ?? pool;
    const { rows } = await executor.query<{ order_number: string }>(
      `SELECT o.order_number
       FROM orders o
       LEFT JOIN queue_entries qe ON qe.order_id = o.id
       WHERE ($1::uuid IS NOT NULL AND o.id = $1::uuid)
          OR qe.id = $2::uuid
       LIMIT 1`,
      [orderId ?? null, queueEntryId]
    );
    return rows[0]?.order_number ?? null;
  },

  /**
   * Fetch active-ticket orders in one query for the customer ticket list.
   * The map key is the queue entry ID so callers cannot accidentally match an
   * organization order to the wrong ticket.
   */
  async findByQueueEntries(queueEntryIds: string[]): Promise<Map<string, OrderWithItems>> {
    if (queueEntryIds.length === 0) return new Map();

    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         qe.id AS queue_entry_id,
         la.display_name AS customer_line_display_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_image_url', p.image_url,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'payment_status', oi.payment_status,
               'prepaid_amount', oi.prepaid_amount,
               'refunded_amount', oi.refunded_amount,
               'payment_transaction_id', oi.payment_transaction_id,
               'requires_prepayment_snapshot', oi.requires_prepayment_snapshot,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       JOIN queue_entries qe ON qe.order_id = o.id
       LEFT JOIN line_accounts la ON la.user_id = o.customer_user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE qe.id = ANY($1::uuid[])
       GROUP BY o.id, qe.id, la.display_name`,
      [queueEntryIds]
    );

    return new Map(
      rows
        .filter((row) => row.queue_entry_id)
        .map((row) => [
          row.queue_entry_id as string,
          { ...row, items: row.items_json as unknown as OrderItemRow[] },
        ])
    );
  },

  async create(
    data: {
      organizationId: string;
      branchId: string;
      queueId: string;
      orderNumber: string;
      bookingGroupId?: string;
      customerLineUserId?: string;
      customerName?: string;
      customerUserId?: string;
      customerPhone?: string;
      subtotal: number;
      paymentStatus?: string;
      paymentCode?: string;
      notes?: string;
    },
    client?: PoolClient
  ): Promise<OrderRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<OrderRow>(
      `INSERT INTO orders
       (
         organization_id, branch_id, queue_id, order_number, customer_name,
         customer_user_id, customer_line_user_id, customer_phone, subtotal,
         payment_status, payment_code, notes, booking_group_id,
         organization_name_snapshot, branch_name_snapshot, queue_name_snapshot
       )
       SELECT
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         organization.name, branch.name, queue.name
       FROM organizations organization
       JOIN organization_branches branch
         ON branch.id = $2 AND branch.organization_id = organization.id
       JOIN queues queue
         ON queue.id = $3
        AND queue.organization_id = organization.id
        AND queue.branch_id = branch.id
       WHERE organization.id = $1
       RETURNING *, NULL::uuid AS queue_entry_id`,
      [
        data.organizationId,
        data.branchId,
        data.queueId,
        data.orderNumber,
        data.customerName ?? null,
        data.customerUserId ?? null,
        data.customerLineUserId ?? null,
        data.customerPhone ?? null,
        data.subtotal,
        data.paymentStatus ?? 'unpaid',
        data.paymentCode ?? null,
        data.notes ?? null,
        data.bookingGroupId ?? null,
      ]
    );
    if (!rows[0]) {
      throw new Error('Order scope could not be resolved');
    }
    return rows[0];
  },

  async findActiveBookingGroupForLineUser(
    organizationId: string,
    branchId: string,
    lineUserId: string,
    client: PoolClient
  ): Promise<string | null> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `booking-group:${organizationId}:${branchId}:${lineUserId}`,
    ]);
    const { rows } = await client.query<{ booking_group_id: string }>(
      `SELECT o.booking_group_id
       FROM orders o
       JOIN queue_entries qe ON qe.order_id = o.id
       WHERE o.organization_id = $1
         AND o.branch_id = $2
         AND o.customer_line_user_id = $3
         AND o.booking_group_id IS NOT NULL
         AND o.status IN ('pending','processing')
         AND qe.status IN ('waiting','called','serving')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [organizationId, branchId, lineUserId]
    );
    return rows[0]?.booking_group_id ?? null;
  },

  async findActiveOrderForLineUserInQueue(
    organizationId: string,
    branchId: string,
    queueId: string,
    lineUserId: string,
    client: PoolClient
  ): Promise<ActiveOrderInQueue | null> {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `active-order:${organizationId}:${branchId}:${queueId}:${lineUserId}`,
    ]);
    const { rows } = await client.query<{
      order_record: OrderRow;
      queue_entry: QueueEntryRow;
    }>(
      `SELECT to_jsonb(o) AS order_record,
              to_jsonb(qe) AS queue_entry
       FROM orders o
       JOIN queue_entries qe ON qe.order_id = o.id
       WHERE o.organization_id = $1
         AND o.branch_id = $2
         AND o.queue_id = $3
         AND o.customer_line_user_id = $4
         AND o.status IN ('pending','processing')
         AND qe.status IN ('waiting','called','serving')
       ORDER BY o.created_at DESC
       LIMIT 1
       FOR UPDATE OF o, qe`,
      [organizationId, branchId, queueId, lineUserId]
    );
    const row = rows[0];
    return row ? { order: row.order_record, entry: row.queue_entry } : null;
  },

  async refreshActiveOrder(
    data: {
      orderId: string;
      customerName: string;
      customerPhone: string;
      paymentCode?: string;
      notes?: string;
    },
    client: PoolClient
  ): Promise<OrderRow> {
    const { rows } = await client.query<OrderRow>(
      `UPDATE orders order_record
       SET customer_name = $2,
           customer_phone = $3,
           subtotal = (
             SELECT COALESCE(SUM(item.subtotal), 0)
             FROM order_items item
             WHERE item.order_id = order_record.id
           ),
           payment_status = CASE
             WHEN EXISTS (
               SELECT 1
               FROM order_items item
               WHERE item.order_id = order_record.id
                 AND item.payment_status <> 'paid'::payment_status
             ) THEN 'unpaid'::payment_status
             ELSE 'paid'::payment_status
           END,
           payment_code = COALESCE($4, payment_code),
           notes = CASE
             WHEN NULLIF(BTRIM($5), '') IS NULL THEN notes
             WHEN notes IS NULL OR BTRIM(notes) = '' THEN $5
             ELSE notes || E'\n' || $5
           END,
           updated_at = NOW()
       WHERE order_record.id = $1
         AND order_record.status IN ('pending','processing')
       RETURNING order_record.*, (
         SELECT qe.id FROM queue_entries qe WHERE qe.order_id = order_record.id
       ) AS queue_entry_id`,
      [
        data.orderId,
        data.customerName,
        data.customerPhone,
        data.paymentCode ?? null,
        data.notes ?? null,
      ]
    );
    if (!rows[0]) throw new Error('Active order could not be refreshed');
    return rows[0];
  },

  async completeWithFulfillment(
    orderId: string,
    actorUserId: string,
    client: PoolClient
  ): Promise<OrderRow | null> {
    const { rows } = await client.query<OrderRow>(
      `UPDATE orders order_record
       SET status = 'completed',
           fulfilled_by_user_id = actor.id,
           fulfilled_by_name = actor.display_name,
           fulfilled_by_employee_code = actor.employee_code,
           fulfilled_at = NOW()
       FROM users actor
       WHERE order_record.id = $1
         AND actor.id = $2
         AND order_record.status IN ('pending','processing')
       RETURNING order_record.*`,
      [orderId, actorUserId]
    );
    return rows[0] ?? null;
  },

  async ensureBookingGroup(
    data: {
      id: string;
      organizationId: string;
      customerUserId?: string;
      customerLineUserId?: string;
      localDeviceKey?: string;
    },
    client?: PoolClient
  ): Promise<boolean> {
    const executor = client ?? pool;
    const result = await executor.query(
      `INSERT INTO booking_groups
         (id, organization_id, customer_user_id, customer_line_user_id, local_device_key)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE
       SET updated_at = NOW(),
           customer_user_id = COALESCE(booking_groups.customer_user_id, EXCLUDED.customer_user_id),
           customer_line_user_id = COALESCE(booking_groups.customer_line_user_id, EXCLUDED.customer_line_user_id),
           local_device_key = COALESCE(booking_groups.local_device_key, EXCLUDED.local_device_key)
       WHERE booking_groups.organization_id = EXCLUDED.organization_id`,
      [
        data.id,
        data.organizationId,
        data.customerUserId ?? null,
        data.customerLineUserId ?? null,
        data.localDeviceKey ?? null,
      ]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async createItem(
    data: {
      orderId: string;
      productId: string;
      productName: string;
      productPrice: number;
      serviceTimeMinutes: number;
      quantity: number;
      subtotal: number;
      paymentStatus?: string;
      prepaidAmount?: number;
      paymentTransactionId?: string | null;
      requiresPrepaymentSnapshot?: boolean;
    },
    client?: PoolClient
  ): Promise<OrderItemRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<OrderItemRow>(
      `INSERT INTO order_items
         (
           order_id, product_id, product_name, product_price, service_time_minutes,
           quantity, subtotal, payment_status, prepaid_amount, payment_transaction_id,
           requires_prepayment_snapshot
         )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.orderId,
        data.productId,
        data.productName,
        data.productPrice,
        data.serviceTimeMinutes,
        data.quantity,
        data.subtotal,
        data.paymentStatus ?? 'unpaid',
        data.prepaidAmount ?? 0,
        data.paymentTransactionId ?? null,
        data.requiresPrepaymentSnapshot ?? false,
      ]
    );
    return rows[0];
  },

  async createPaymentTransaction(
    data: {
      organizationId: string;
      orderId: string;
      provider: string;
      method: string;
      externalTransactionId?: string;
      status: string;
      amount: number;
      currency?: string;
      rawPayload?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<PaymentTransactionRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentTransactionRow>(
      `INSERT INTO payment_transactions
         (
           organization_id, order_id, provider, method, external_transaction_id,
           status, amount, currency, raw_payload, paid_at
         )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.organizationId,
        data.orderId,
        data.provider,
        data.method,
        data.externalTransactionId ?? null,
        data.status,
        data.amount,
        data.currency ?? 'JPY',
        JSON.stringify(data.rawPayload ?? {}),
        data.status === 'paid' ? new Date() : null,
      ]
    );
    return rows[0];
  },

  async reserveInventory(
    data: {
      organizationId: string;
      orderId: string;
      productId: string;
      quantity: number;
    },
    client?: PoolClient
  ): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
      `INSERT INTO inventory_reservations (organization_id, order_id, product_id, quantity, status)
       VALUES ($1,$2,$3,$4,'reserved')`,
      [data.organizationId, data.orderId, data.productId, data.quantity]
    );
  },

  async createCustomerLocation(
    data: {
      organizationId: string;
      queueEntryId: string;
      customerUserId?: string;
      localDeviceKey?: string;
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
      distanceToOrgMeters?: number | null;
      consentUserId: string;
      expiresAt: Date;
    },
    client?: PoolClient
  ): Promise<CustomerLocationRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<CustomerLocationRow>(
      `INSERT INTO customer_locations
         (
           organization_id, queue_entry_id, customer_user_id, local_device_key,
           latitude, longitude, accuracy_meters, distance_to_org_meters,
           consent_user_id, expires_at
         )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.organizationId,
        data.queueEntryId,
        data.customerUserId ?? null,
        data.localDeviceKey ?? null,
        data.latitude,
        data.longitude,
        data.accuracyMeters ?? null,
        data.distanceToOrgMeters ?? null,
        data.consentUserId,
        data.expiresAt,
      ]
    );
    return rows[0];
  },

  async createLocationAlert(
    data: {
      organizationId: string;
      queueEntryId: string;
      customerLocationId: string;
      distanceToOrgMeters: number;
      thresholdMeters: number;
      dueAt?: Date;
      rawPayload?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<LocationAlertRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<LocationAlertRow>(
      `INSERT INTO location_alerts
         (
           organization_id, queue_entry_id, customer_location_id, distance_to_org_meters,
           threshold_meters, due_at, raw_payload, event_key
         )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (event_key) DO UPDATE
       SET customer_location_id = EXCLUDED.customer_location_id,
           distance_to_org_meters = EXCLUDED.distance_to_org_meters,
           threshold_meters = EXCLUDED.threshold_meters,
           due_at = EXCLUDED.due_at,
           raw_payload = EXCLUDED.raw_payload,
           status = 'pending',
           updated_at = NOW()
       RETURNING *`,
      [
        data.organizationId,
        data.queueEntryId,
        data.customerLocationId,
        data.distanceToOrgMeters,
        data.thresholdMeters,
        data.dueAt ?? null,
        JSON.stringify(data.rawPayload ?? {}),
        `location_alert:${data.queueEntryId}:far_before_turn`,
      ]
    );
    return rows[0];
  },

  async updateStatus(id: string, status: string, client?: PoolClient): Promise<OrderRow | null> {
    const executor = client ?? pool;
    const { rows } = await executor.query<OrderRow>(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] ?? null;
  },

  async updatePayment(id: string, paymentStatus: string): Promise<OrderRow | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OrderRow>(
        `UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *`,
        [paymentStatus, id]
      );
      await client.query(
        `UPDATE order_items
         SET payment_status = $1,
             prepaid_amount = CASE WHEN $1 = 'paid' THEN subtotal ELSE 0 END
         WHERE order_id = $2`,
        [paymentStatus, id]
      );
      await client.query('COMMIT');
      return rows[0] ?? null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getStats(
    orgId: string,
    branchId?: string
  ): Promise<{
    totalRevenue: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    cancellationRate: number;
    activeQueueEntries: number;
    averageEtaSeconds: number;
    monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
    topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
    totalProducts: number;
    currentQueueDepth: number;
    bestStaff: {
      user_id: string;
      display_name: string;
      employee_code: string | null;
      completed_orders: number;
      revenue: number;
    } | null;
  }> {
    //
    // Performance optimizations vs original:
    //   1. Merge 8 parallel queries into 6 — summary+ETA combined, queue+products combined.
    //   2. Use idx_orders_org_completed_date partial index for daily+top by constraining
    //      the date range before aggregation.
    //   3. ETA: use COUNT approach instead of ROW_NUMBER window function.
    //      AVG( (position-1) * avg_service_seconds ) is equivalent but cheaper.
    //
    const [summaryEta, monthly, top, queueAndProducts, bestStaff] = await Promise.all([
      // Merged: order summary counts + ETA estimate in one CTE pass
      pool.query<{
        total: string;
        completed: string;
        cancelled: string;
        pending: string;
        revenue: string;
        average_eta_seconds: string;
      }>(
        `WITH order_summary AS (
             SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE o.status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled,
               COUNT(*) FILTER (WHERE o.status IN ('pending','processing')) AS pending,
               COALESCE(
                 SUM(
                   COALESCE(payment.collected_amount, 0)
                 ) FILTER (WHERE o.status = 'completed'),
                 0
               ) AS revenue
             FROM orders o
             JOIN queue_entries order_entry ON order_entry.order_id = o.id
             JOIN queues order_queue ON order_queue.id = order_entry.queue_id
             LEFT JOIN LATERAL (
               SELECT COALESCE(
                 SUM(GREATEST(item.prepaid_amount - item.refunded_amount, 0)),
                 0
               ) AS collected_amount
               FROM order_items item
               WHERE item.order_id = o.id
             ) payment ON TRUE
             WHERE o.organization_id = $1
               AND ($2::uuid IS NULL OR order_queue.branch_id = $2)
           ),
           eta_summary AS (
             SELECT
               COALESCE(
                 AVG(
                   (
                     SELECT COUNT(*)
                     FROM queue_entries ahead
                     WHERE ahead.queue_id = qe.queue_id
                       AND ahead.status = 'waiting'
                       AND (
                         ahead.priority > qe.priority
                         OR (ahead.priority = qe.priority AND ahead.ticket_number < qe.ticket_number)
                       )
                   ) * q.avg_service_seconds
                 ), 0
               ) AS average_eta_seconds
             FROM queue_entries qe
             JOIN queues q ON q.id = qe.queue_id
             WHERE q.organization_id = $1
               AND ($2::uuid IS NULL OR q.branch_id = $2)
               AND q.is_active = TRUE
               AND qe.status = 'waiting'
           )
           SELECT os.*, es.average_eta_seconds
           FROM order_summary os, eta_summary es`,
        [orgId, branchId ?? null]
      ),
      pool.query<{ month: string; revenue: string; orders: string }>(
        `WITH months AS (
             SELECT generate_series(
               DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
               DATE_TRUNC('month', NOW()),
               INTERVAL '1 month'
             ) AS month
           ),
           completed_orders AS (
             SELECT DATE_TRUNC('month', o.fulfilled_at) AS month,
                    COUNT(DISTINCT o.id) AS orders,
                    COALESCE(SUM(payment.collected_amount), 0) AS revenue
             FROM orders o
             JOIN queue_entries qe ON qe.order_id = o.id
             JOIN queues q ON q.id = qe.queue_id
             LEFT JOIN LATERAL (
               SELECT COALESCE(
                 SUM(GREATEST(item.prepaid_amount - item.refunded_amount, 0)),
                 0
               ) AS collected_amount
               FROM order_items item
               WHERE item.order_id = o.id
             ) payment ON TRUE
             WHERE o.organization_id = $1
               AND ($2::uuid IS NULL OR q.branch_id = $2)
               AND o.status = 'completed'
               AND o.fulfilled_at >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
             GROUP BY DATE_TRUNC('month', o.fulfilled_at)
           )
           SELECT TO_CHAR(months.month, 'YYYY-MM') AS month,
                  COALESCE(completed.orders, 0)::TEXT AS orders,
                  COALESCE(completed.revenue, 0)::TEXT AS revenue
           FROM months
           LEFT JOIN completed_orders completed ON completed.month = months.month
           ORDER BY months.month`,
        [orgId, branchId ?? null]
      ),
      // Top products — hits idx_order_items_order_covering
      pool.query<{ product_name: string; total_sold: string; revenue: string }>(
        `SELECT oi.product_name,
                SUM(oi.quantity) AS total_sold,
                SUM(GREATEST(oi.prepaid_amount - oi.refunded_amount, 0)) AS revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN queue_entries qe ON qe.order_id = o.id
         JOIN queues q ON q.id = qe.queue_id
         WHERE o.organization_id = $1
           AND ($2::uuid IS NULL OR q.branch_id = $2)
           AND o.status = 'completed'
         GROUP BY oi.product_name
         ORDER BY total_sold DESC
         LIMIT 3`,
        [orgId, branchId ?? null]
      ),
      // Merged: active queue depth + total products in one query pair
      Promise.all([
        pool.query<{ count: string }>(
          `SELECT COUNT(*) FROM queue_entries qe
             JOIN queues q ON qe.queue_id = q.id
             WHERE q.organization_id = $1
               AND ($2::uuid IS NULL OR q.branch_id = $2)
               AND qe.status IN ('waiting','called','serving')`,
          [orgId, branchId ?? null]
        ),
        pool.query<{ count: string }>(
          `SELECT COUNT(DISTINCT product.id)
             FROM products product
             WHERE product.organization_id = $1
               AND product.is_active = TRUE
               AND (
                 $2::uuid IS NULL
                 OR EXISTS (
                   SELECT 1
                   FROM queue_products assignment
                   WHERE assignment.product_id = product.id
                     AND assignment.branch_id = $2
                     AND assignment.is_active = TRUE
                 )
               )`,
          [orgId, branchId ?? null]
        ),
      ]),
      pool.query<{
        user_id: string;
        display_name: string;
        employee_code: string | null;
        completed_orders: string;
        revenue: string;
      }>(
        `SELECT o.fulfilled_by_user_id AS user_id,
                  COALESCE(o.fulfilled_by_name, user_account.display_name) AS display_name,
                  o.fulfilled_by_employee_code AS employee_code,
                  COUNT(DISTINCT o.id)::TEXT AS completed_orders,
                  COALESCE(SUM(payment.collected_amount), 0)::TEXT AS revenue
           FROM orders o
           JOIN queue_entries qe ON qe.order_id = o.id
           JOIN queues q ON q.id = qe.queue_id
           LEFT JOIN users user_account ON user_account.id = o.fulfilled_by_user_id
           LEFT JOIN LATERAL (
             SELECT COALESCE(
               SUM(GREATEST(item.prepaid_amount - item.refunded_amount, 0)),
               0
             ) AS collected_amount
             FROM order_items item
             WHERE item.order_id = o.id
           ) payment ON TRUE
           WHERE o.organization_id = $1
             AND ($2::uuid IS NULL OR q.branch_id = $2)
             AND o.status = 'completed'
             AND o.fulfilled_at >= DATE_TRUNC('month', NOW())
             AND o.fulfilled_by_user_id IS NOT NULL
           GROUP BY o.fulfilled_by_user_id, o.fulfilled_by_name,
                    o.fulfilled_by_employee_code, user_account.display_name
           ORDER BY revenue DESC, completed_orders DESC
           LIMIT 1`,
        [orgId, branchId ?? null]
      ),
    ]);

    const [queueResult, productsResult] = queueAndProducts;
    const s = summaryEta.rows[0];
    const totalOrders = Number.parseInt(s.total);
    const cancelledOrders = Number.parseInt(s.cancelled);
    return {
      totalRevenue: Number.parseFloat(s.revenue),
      totalOrders,
      completedOrders: Number.parseInt(s.completed),
      cancelledOrders,
      pendingOrders: Number.parseInt(s.pending),
      cancellationRate: totalOrders > 0 ? cancelledOrders / totalOrders : 0,
      activeQueueEntries: Number.parseInt(queueResult.rows[0]?.count ?? '0'),
      averageEtaSeconds: Math.round(Number.parseFloat(s.average_eta_seconds ?? '0')),
      monthlyRevenue: monthly.rows.map((r) => ({
        month: r.month,
        revenue: Number.parseFloat(r.revenue),
        orders: Number.parseInt(r.orders),
      })),
      topProducts: top.rows.map((r) => ({
        product_name: r.product_name,
        total_sold: Number.parseInt(r.total_sold),
        revenue: Number.parseFloat(r.revenue),
      })),
      totalProducts: Number.parseInt(productsResult.rows[0]?.count ?? '0'),
      currentQueueDepth: Number.parseInt(queueResult.rows[0]?.count ?? '0'),
      bestStaff: bestStaff.rows[0]
        ? {
            ...bestStaff.rows[0],
            completed_orders: Number(bestStaff.rows[0].completed_orders),
            revenue: Number(bestStaff.rows[0].revenue),
          }
        : null,
    };
  },
};

/**
 * Calculate total workload (in minutes) for a set of queue entries.
 * Single query — replaces per-entry sequential calls.
 */
export async function calculateWorkloadForEntries(entryIds: string[]): Promise<number> {
  if (!entryIds || entryIds.length === 0) return 0;
  const { rows } = await pool.query<{ total_minutes: string }>(
    `SELECT COALESCE(SUM(oi.service_time_minutes * oi.quantity), 0) AS total_minutes
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN queue_entries qe ON qe.order_id = o.id
     WHERE qe.id = ANY($1)`,
    [entryIds]
  );
  return Number.parseFloat(rows[0]?.total_minutes ?? '0');
}

/**
 * Batch workload calculation: returns a Map<queueEntryId, totalWorkloadMinutes>.
 *
 * Used by getMyTickets to replace N sequential calculateWorkloadForEntries calls
 * with a single aggregating query.
 *
 * Any entry not in the result set had no order_items → workload = 0.
 */
export async function batchWorkloadForEntries(entryIds: string[]): Promise<Map<string, number>> {
  if (entryIds.length === 0) return new Map();

  const { rows } = await pool.query<{ queue_entry_id: string; total_minutes: string }>(
    `SELECT qe.id AS queue_entry_id,
            COALESCE(SUM(oi.service_time_minutes * oi.quantity), 0) AS total_minutes
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     JOIN queue_entries qe ON qe.order_id = o.id
     WHERE qe.id = ANY($1)
     GROUP BY qe.id`,
    [entryIds]
  );

  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.queue_entry_id, Number.parseFloat(row.total_minutes));
  }
  return result;
}
