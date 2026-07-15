import type { PoolClient } from 'pg';

import { config } from '../../config';
import { pool } from '../../db/client';
import { inventoryReservationsRepository } from '../../db/repositories/inventory-reservations.repository';
import { productCatalogCache } from '../../utils/cache';

function expiryDate(now = new Date()): Date | null {
  if (config.inventory.reservationTtlMinutes <= 0) return null;
  return new Date(now.getTime() + config.inventory.reservationTtlMinutes * 60_000);
}

export const inventoryService = {
  async reserveFiniteProduct(
    params: {
      organizationId: string;
      orderId: string;
      productId: string;
      quantity: number;
      actorId?: string;
    },
    client: PoolClient
  ) {
    return inventoryReservationsRepository.reserve({ ...params, expiresAt: expiryDate() }, client);
  },

  async consumeOrder(orderId: string, client: PoolClient, actorId?: string): Promise<number> {
    return inventoryReservationsRepository.transitionOrder(
      { orderId, toStatus: 'consumed', reason: 'fulfillment_completed', actorId },
      client
    );
  },

  async releaseOrder(
    orderId: string,
    client: PoolClient,
    reason = 'order_cancelled',
    actorId?: string
  ): Promise<number> {
    const changed = await inventoryReservationsRepository.transitionOrder(
      { orderId, toStatus: 'released', reason, actorId },
      client
    );
    return changed;
  },

  async expireDue(limit = config.inventory.expiryBatchSize): Promise<number> {
    const client = await pool.connect();
    const affectedOrganizations = new Set<string>();
    try {
      await client.query('BEGIN');
      const orderIds = await inventoryReservationsRepository.claimExpiredOrderIds(limit, client);
      for (const orderId of orderIds) {
        const order = await client.query<{ organization_id: string }>(
          `UPDATE orders
           SET status = 'cancelled'
           WHERE id = $1 AND status IN ('pending','processing')
           RETURNING organization_id`,
          [orderId]
        );
        if (!order.rows[0]) continue;
        affectedOrganizations.add(order.rows[0].organization_id);
        await inventoryReservationsRepository.transitionOrder(
          { orderId, toStatus: 'expired', reason: 'reservation_expired' },
          client
        );
        await client.query(
          `UPDATE queue_entries
           SET status = 'cancelled', cancelled_at = NOW()
           WHERE order_id = $1 AND status IN ('waiting','called')`,
          [orderId]
        );
      }
      await client.query('COMMIT');
      for (const organizationId of affectedOrganizations) {
        productCatalogCache.invalidate(`org:${organizationId}`);
      }
      return orderIds.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
