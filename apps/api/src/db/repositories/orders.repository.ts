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
  ticket_display?: string | null;
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
         qe.ticket_display,
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
       GROUP BY o.id, qe.ticket_display, qe.status
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

  async findByQueueEntry(queueEntryId: string): Promise<OrderWithItems | null> {
    const { rows } = await pool.query<OrderRow>(
      `SELECT * FROM orders WHERE queue_entry_id = $1 LIMIT 1`,
      [queueEntryId]
    );
    if (!rows[0]) return null;
    return this.findById(rows[0].id);
  },

  async create(data: {
    organizationId: string;
    queueEntryId?: string;
    orderNumber: string;
    customerName?: string;
    customerUserId?: string;
    customerPhone?: string;
    subtotal: number;
    paymentCode?: string;
    notes?: string;
  }, client?: PoolClient): Promise<OrderRow> {
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

  async createItem(data: {
    orderId: string;
    productId: string;
    productName: string;
    productPrice: number;
    serviceTimeMinutes: number;
    quantity: number;
    subtotal: number;
  }, client?: PoolClient): Promise<OrderItemRow> {
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
    completedOrders: number;
    cancelledOrders: number;
    pendingOrders: number;
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
    topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
    totalProducts: number;
    currentQueueDepth: number;
  }> {
    const [summary, daily, top, products, queue] = await Promise.all([
      pool.query<{ completed: string; cancelled: string; pending: string; revenue: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
           COUNT(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
           COALESCE(SUM(subtotal) FILTER (WHERE status = 'completed'), 0) AS revenue
         FROM orders WHERE organization_id = $1`,
        [orgId]
      ),
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
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM products WHERE organization_id = $1 AND is_active = TRUE`,
        [orgId]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM queue_entries qe
         JOIN queues q ON qe.queue_id = q.id
         WHERE q.organization_id = $1 AND qe.status = 'waiting'`,
        [orgId]
      ),
    ]);

    const s = summary.rows[0];
    return {
      totalRevenue: parseFloat(s.revenue),
      completedOrders: parseInt(s.completed),
      cancelledOrders: parseInt(s.cancelled),
      pendingOrders: parseInt(s.pending),
      dailyRevenue: daily.rows.map((r) => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        orders: parseInt(r.orders),
      })),
      topProducts: top.rows.map((r) => ({
        product_name: r.product_name,
        total_sold: parseInt(r.total_sold),
        revenue: parseFloat(r.revenue),
      })),
      totalProducts: parseInt(products.rows[0]?.count ?? '0'),
      currentQueueDepth: parseInt(queue.rows[0]?.count ?? '0'),
    };
  },
};

/**
 * Calculate total workload (in minutes) for queue entries.
 * Returns sum of (service_time_minutes × quantity) for all order items
 * linked to the specified queue entry IDs.
 * Used for workload-aware ETA calculation.
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
  return parseFloat(rows[0]?.total_minutes ?? '0');
}
