import type { PoolClient } from 'pg';

import { AppError } from '../../utils/AppError';

export type InventoryReservationStatus = 'reserved' | 'consumed' | 'released' | 'expired';

export interface InventoryReservationRow {
  id: string;
  organization_id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  status: InventoryReservationStatus;
  expires_at: Date | null;
  consumed_at: Date | null;
  released_at: Date | null;
  expired_at: Date | null;
  release_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export const inventoryReservationsRepository = {
  async reserve(
    params: {
      organizationId: string;
      orderId: string;
      productId: string;
      quantity: number;
      expiresAt?: Date | null;
      actorId?: string;
    },
    client: PoolClient
  ): Promise<InventoryReservationRow> {
    const stock = await client.query<{ id: string }>(
      `UPDATE products
       SET stock_quantity = stock_quantity - $1
       WHERE id = $2
         AND organization_id = $3
         AND stock_quantity IS NOT NULL
         AND stock_quantity >= $1
       RETURNING id`,
      [params.quantity, params.productId, params.organizationId]
    );
    if (!stock.rows[0]) throw AppError.conflict('Insufficient finite stock');

    const reservation = await client.query<InventoryReservationRow>(
      `INSERT INTO inventory_reservations
         (organization_id, order_id, product_id, quantity, status, expires_at)
       VALUES ($1,$2,$3,$4,'reserved',$5)
       RETURNING *`,
      [
        params.organizationId,
        params.orderId,
        params.productId,
        params.quantity,
        params.expiresAt ?? null,
      ]
    );
    const row = reservation.rows[0];
    await this.recordEvent(row, null, 'reserved', 'order_created', params.actorId, client);
    return row;
  },

  async findByOrderForUpdate(orderId: string, client: PoolClient) {
    const { rows } = await client.query<InventoryReservationRow>(
      `SELECT * FROM inventory_reservations
       WHERE order_id = $1
       ORDER BY id
       FOR UPDATE`,
      [orderId]
    );
    return rows;
  },

  async transitionOrder(
    params: {
      orderId: string;
      toStatus: Exclude<InventoryReservationStatus, 'reserved'>;
      reason: string;
      actorId?: string;
    },
    client: PoolClient
  ): Promise<number> {
    const rows = await this.findByOrderForUpdate(params.orderId, client);
    let changed = 0;

    for (const reservation of rows) {
      if (reservation.status !== 'reserved') continue;
      const timestampColumn =
        params.toStatus === 'consumed'
          ? 'consumed_at'
          : params.toStatus === 'expired'
            ? 'expired_at'
            : 'released_at';
      const updated = await client.query<InventoryReservationRow>(
        `UPDATE inventory_reservations
         SET status = $2,
             ${timestampColumn} = NOW(),
             release_reason = CASE WHEN $2 IN ('released','expired') THEN $3 ELSE release_reason END
         WHERE id = $1 AND status = 'reserved'
         RETURNING *`,
        [reservation.id, params.toStatus, params.reason]
      );
      const current = updated.rows[0];
      if (!current) continue;

      if (params.toStatus === 'released' || params.toStatus === 'expired') {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + $1
           WHERE id = $2 AND stock_quantity IS NOT NULL`,
          [reservation.quantity, reservation.product_id]
        );
      }
      await this.recordEvent(
        current,
        'reserved',
        params.toStatus,
        params.reason,
        params.actorId,
        client
      );
      changed += 1;
    }
    return changed;
  },

  async claimExpiredOrderIds(limit: number, client: PoolClient): Promise<string[]> {
    const { rows } = await client.query<{ order_id: string }>(
      `WITH claimed AS (
         SELECT ir.id, ir.order_id
         FROM inventory_reservations ir
         JOIN orders o ON o.id = ir.order_id
         WHERE ir.status = 'reserved'
           AND ir.expires_at IS NOT NULL
           AND ir.expires_at <= NOW()
           AND o.status IN ('pending','processing')
         ORDER BY ir.expires_at, ir.id
         LIMIT $1
         FOR UPDATE OF ir SKIP LOCKED
       )
       SELECT DISTINCT order_id FROM claimed`,
      [limit]
    );
    return rows.map((row) => row.order_id);
  },

  async recordEvent(
    reservation: InventoryReservationRow,
    fromStatus: InventoryReservationStatus | null,
    toStatus: InventoryReservationStatus,
    reason: string,
    actorId: string | undefined,
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `INSERT INTO inventory_reservation_events
         (reservation_id, organization_id, order_id, product_id, from_status,
          to_status, quantity, reason, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        reservation.id,
        reservation.organization_id,
        reservation.order_id,
        reservation.product_id,
        fromStatus,
        toStatus,
        reservation.quantity,
        reason,
        actorId ?? null,
      ]
    );
  },
};
