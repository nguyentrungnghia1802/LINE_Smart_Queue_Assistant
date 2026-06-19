import { PoolClient } from 'pg';

import { pool } from '../client';

export interface OrderRow {
  id: string;
  organization_id: string;
  queue_entry_id: string | null;
  order_number: string;
  customer_name: string | null;
  customer_user_id: string | null;
  customer_phone: string | null;
  status: string;
  subtotal: string;
  payment_status: string;
  payment_code: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  // Enriched fields from queue_entries join (present in some queries)
  ticket_code?: string | null;
  queue_entry_status?: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price: string;
  service_time_minutes: number;
  quantity: number;
  subtotal: string;
  created_at: Date;
}

export interface OrderWithItems extends OrderRow {
  items: OrderItemRow[];
}

export const ordersRepository = {
  async findByOrg(orgId: string, status?: string): Promise<OrderWithItems[]> {
    const statusClause = status ? `AND o.status = $2` : '';
    const params: unknown[] = status ? [orgId, status] : [orgId];
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         qe.ticket_code,
         qe.status AS queue_entry_status,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN queue_entries qe ON qe.id = o.queue_entry_id
       WHERE o.organization_id = $1 ${statusClause}
       GROUP BY o.id, qe.ticket_code, qe.status
       ORDER BY o.created_at DESC`,
      params
    );
    return rows.map((r) => ({ ...r, items: r.items_json as unknown as OrderItemRow[] }));
  },

  async findById(id: string): Promise<OrderWithItems | null> {
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: r.items_json as unknown as OrderItemRow[] };
  },

  /**
   * Find an order with its items by queue entry ID.
   * Single JOIN query — eliminates the N+1 that existed when doing
   * SELECT * followed by findById(id).
   */
  async findByQueueEntry(queueEntryId: string): Promise<OrderWithItems | null> {
    const { rows } = await pool.query<OrderRow & { items_json: string }>(
      `SELECT o.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id', oi.id,
               'order_id', oi.order_id,
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'service_time_minutes', oi.service_time_minutes,
               'quantity', oi.quantity,
               'subtotal', oi.subtotal,
               'created_at', oi.created_at
             ) ORDER BY oi.created_at
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items_json
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.queue_entry_id = $1
       GROUP BY o.id
       LIMIT 1`,
      [queueEntryId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...r, items: r.items_json as unknown as OrderItemRow[] };
  },

  async create(
    data: {
      organizationId: string;
      queueEntryId?: string;
      orderNumber: string;
      customerName?: string;
      customerUserId?: string;
      customerPhone?: string;
      subtotal: number;
      paymentCode?: string;
      notes?: string;
    },
    client?: PoolClient
  ): Promise<OrderRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<OrderRow>(
      `INSERT INTO orders
         (organization_id, queue_entry_id, order_number, customer_name,
          customer_user_id, customer_phone, subtotal, payment_code, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.organizationId,
        data.queueEntryId ?? null,
        data.orderNumber,
        data.customerName ?? null,
        data.customerUserId ?? null,
        data.customerPhone ?? null,
        data.subtotal,
        data.paymentCode ?? null,
        data.notes ?? null,
      ]
    );
    return rows[0];
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
    },
    client?: PoolClient
  ): Promise<OrderItemRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<OrderItemRow>(
      `INSERT INTO order_items
         (order_id, product_id, product_name, product_price, service_time_minutes, quantity, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.orderId,
        data.productId,
        data.productName,
        data.productPrice,
        data.serviceTimeMinutes,
        data.quantity,
        data.subtotal,
      ]
    );
    return rows[0];
  },

  async updateStatus(id: string, status: string): Promise<OrderRow | null> {
    const { rows } = await pool.query<OrderRow>(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] ?? null;
  },

  async updatePayment(id: string, paymentStatus: string): Promise<OrderRow | null> {
    const { rows } = await pool.query<OrderRow>(
      `UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *`,
      [paymentStatus, id]
    );
    return rows[0] ?? null;
  },

  async getStats(orgId: string): Promise<{
    totalRevenue: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    cancellationRate: number;
    activeQueueEntries: number;
    averageEtaSeconds: number;
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
    topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
    totalProducts: number;
    currentQueueDepth: number;
    recentOrders: Array<{
      id: string;
      order_number: string;
      customer_name: string | null;
      status: string;
      subtotal: number;
      payment_status: string;
      created_at: Date;
      item_count: number;
    }>;
    recentQueueActivities: Array<{
      entry_id: string;
      queue_id: string;
      queue_name: string;
      ticket_code: string;
      status: string;
      updated_at: Date;
      order_number: string | null;
      customer_name: string | null;
    }>;
  }> {
    //
    // Performance optimizations vs original:
    //   1. Merge 8 parallel queries into 6 — summary+ETA combined, queue+products combined.
    //   2. Use idx_orders_org_completed_date partial index for daily+top by constraining
    //      the date range before aggregation.
    //   3. ETA: use COUNT approach instead of ROW_NUMBER window function.
    //      AVG( (position-1) * avg_service_seconds ) is equivalent but cheaper.
    //
    const [summaryEta, daily, top, queueAndProducts, recentOrders, recentQueueActivities] =
      await Promise.all([
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
               COUNT(*) FILTER (WHERE status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
               COUNT(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
               COALESCE(SUM(subtotal) FILTER (WHERE status = 'completed'), 0) AS revenue
             FROM orders
             WHERE organization_id = $1
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
               AND q.is_active = TRUE
               AND qe.status = 'waiting'
           )
           SELECT os.*, es.average_eta_seconds
           FROM order_summary os, eta_summary es`,
          [orgId]
        ),
        // Daily revenue — hits idx_orders_org_completed_date
        pool.query<{ date: string; revenue: string; orders: string }>(
          `SELECT DATE(created_at)::text AS date,
                COALESCE(SUM(subtotal), 0) AS revenue,
                COUNT(*) AS orders
         FROM orders
         WHERE organization_id = $1
           AND status = 'completed'
           AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY date`,
          [orgId]
        ),
        // Top products — hits idx_order_items_order_covering
        pool.query<{ product_name: string; total_sold: string; revenue: string }>(
          `SELECT oi.product_name,
                SUM(oi.quantity) AS total_sold,
                SUM(oi.subtotal) AS revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.organization_id = $1 AND o.status = 'completed'
         GROUP BY oi.product_name
         ORDER BY total_sold DESC
         LIMIT 5`,
          [orgId]
        ),
        // Merged: active queue depth + total products in one query pair
        Promise.all([
          pool.query<{ count: string }>(
            `SELECT COUNT(*) FROM queue_entries qe
             JOIN queues q ON qe.queue_id = q.id
             WHERE q.organization_id = $1 AND qe.status IN ('waiting','called','serving')`,
            [orgId]
          ),
          pool.query<{ count: string }>(
            `SELECT COUNT(*) FROM products WHERE organization_id = $1 AND is_active = TRUE`,
            [orgId]
          ),
        ]),
        // Recent orders with item count — no ETA, just ORDER BY created_at DESC
        pool.query<{
          id: string;
          order_number: string;
          customer_name: string | null;
          status: string;
          subtotal: string;
          payment_status: string;
          created_at: Date;
          item_count: string;
        }>(
          `SELECT
           o.id,
           o.order_number,
           o.customer_name,
           o.status,
           o.subtotal,
           o.payment_status,
           o.created_at,
           COALESCE(SUM(oi.quantity), 0) AS item_count
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.organization_id = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC
         LIMIT 10`,
          [orgId]
        ),
        // Recent queue activities — hits idx_qe_queue_updated
        pool.query<{
          entry_id: string;
          queue_id: string;
          queue_name: string;
          ticket_code: string;
          status: string;
          updated_at: Date;
          order_number: string | null;
          customer_name: string | null;
        }>(
          `SELECT
           qe.id AS entry_id,
           q.id AS queue_id,
           q.name AS queue_name,
           qe.ticket_code,
           qe.status,
           qe.updated_at,
           o.order_number,
           o.customer_name
         FROM queue_entries qe
         JOIN queues q ON q.id = qe.queue_id
         LEFT JOIN orders o ON o.queue_entry_id = qe.id
         WHERE q.organization_id = $1
         ORDER BY qe.updated_at DESC
         LIMIT 10`,
          [orgId]
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
      dailyRevenue: daily.rows.map((r) => ({
        date: r.date,
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
      recentOrders: recentOrders.rows.map((r) => ({
        ...r,
        subtotal: Number.parseFloat(r.subtotal),
        item_count: Number.parseInt(r.item_count),
      })),
      recentQueueActivities: recentQueueActivities.rows,
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
     WHERE o.queue_entry_id = ANY($1)`,
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
    `SELECT o.queue_entry_id,
            COALESCE(SUM(oi.service_time_minutes * oi.quantity), 0) AS total_minutes
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.queue_entry_id = ANY($1)
     GROUP BY o.queue_entry_id`,
    [entryIds]
  );

  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.queue_entry_id, Number.parseFloat(row.total_minutes));
  }
  return result;
}
