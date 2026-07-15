import { pool } from '../../db/client';

export interface BookingGroupSummary {
  id: string;
  organization_id: string;
  organization_name: string;
  customer_user_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  orders: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    subtotal: string;
    created_at: string;
    ticket: null | {
      id: string;
      ticket_code: string;
      status: string;
      estimated_wait_seconds: number | null;
    };
    items: Array<{
      id: string;
      product_name: string;
      quantity: number;
      subtotal: string;
      payment_status: string;
    }>;
  }>;
}

const GROUP_SELECT = `
  SELECT bg.id, bg.organization_id, org.name AS organization_name, bg.customer_user_id,
         bg.status, bg.created_at, bg.updated_at,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', o.id,
               'order_number', o.order_number,
               'status', o.status,
               'payment_status', o.payment_status,
               'subtotal', o.subtotal,
               'created_at', o.created_at,
               'ticket', CASE WHEN qe.id IS NULL THEN NULL ELSE jsonb_build_object(
                 'id', qe.id,
                 'ticket_code', qe.ticket_code,
                 'status', qe.status,
                 'estimated_wait_seconds', qe.estimated_wait_seconds
               ) END,
               'items', COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'id', oi.id,
                   'product_name', oi.product_name,
                   'quantity', oi.quantity,
                   'subtotal', oi.subtotal,
                   'payment_status', oi.payment_status
                 ) ORDER BY oi.created_at)
                 FROM order_items oi WHERE oi.order_id = o.id
               ), '[]'::jsonb)
             ) ORDER BY o.created_at DESC
           )
           FROM orders o
           LEFT JOIN queue_entries qe ON qe.order_id = o.id
           WHERE o.booking_group_id = bg.id
         ), '[]'::jsonb) AS orders
  FROM booking_groups bg
  JOIN organizations org ON org.id = bg.organization_id
`;

export const bookingGroupsRepository = {
  async listForCustomer(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [groups, count] = await Promise.all([
      pool.query<BookingGroupSummary>(
        `${GROUP_SELECT}
         WHERE bg.customer_user_id = $1
         ORDER BY bg.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM booking_groups WHERE customer_user_id = $1',
        [userId]
      ),
    ]);
    return { items: groups.rows, total: Number(count.rows[0]?.total ?? 0) };
  },

  async findById(id: string): Promise<BookingGroupSummary | null> {
    const result = await pool.query<BookingGroupSummary>(
      `${GROUP_SELECT}
       WHERE bg.id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  },
};
