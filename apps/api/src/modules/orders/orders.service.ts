import type { PoolClient } from 'pg';

import { pool } from '../../db/client';
import { ordersRepository } from '../../db/repositories/orders.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { productCatalogCache } from '../../utils/cache';
import { etaService } from '../eta/eta.service';
import { inventoryService } from '../inventory/inventory.service';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';
import { queueNotificationService } from '../notifications/queue-notification.service';

import { CreateOrderDto, UpdateOrderPaymentDto, UpdateOrderStatusDto } from './orders.validator';

interface OrderActorIdentity {
  userId: string;
  lineUserId?: string;
}

function formatOrderNumber(prefix: string, count: number): string {
  return `${prefix}${String(count).padStart(3, '0')}`;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const radius = 6371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function transactionMetadata(transaction: { metadata?: Record<string, unknown> | null }) {
  return (transaction.metadata ?? {}) as {
    scope?: 'required_items' | 'all_items';
    coveredProductIds?: string[];
    items?: Array<{ productId: string; quantity: number; subtotal: number }>;
  };
}

async function getWaitingPositionInTransaction(
  client: PoolClient,
  entry: { queue_id: string; priority: number; ticket_number: number }
): Promise<number> {
  const { rows } = await client.query<{ pos: string }>(
    `SELECT COUNT(*) AS pos
     FROM queue_entries
     WHERE queue_id = $1
       AND status = 'waiting'
       AND (priority > $2 OR (priority = $2 AND ticket_number < $3))`,
    [entry.queue_id, entry.priority, entry.ticket_number]
  );
  return Number(rows[0]?.pos ?? 0);
}

export const ordersService = {
  async getByOrg(orgId: string, status?: string) {
    return ordersRepository.findByOrg(orgId, status);
  },

  async getById(id: string, orgId?: string) {
    const order = await ordersRepository.findById(id);
    if (!order) throw AppError.notFound('Order not found');

    if (orgId && order.organization_id !== orgId) {
      throw AppError.forbidden("Access denied to this organization's order");
    }

    return order;
  },

  async getStats(orgId: string) {
    return ordersRepository.getStats(orgId);
  },

  async create(dto: CreateOrderDto, actor?: OrderActorIdentity) {
    const actorUserId = actor?.userId;
    const org = await organizationsRepository.findBySlug(dto.orgSlug);
    if (!org) throw AppError.notFound('Organization not found');

    // Load first active queue for this org
    const queues = await queuesRepository.findActiveByOrg(org.id);
    if (queues.length === 0) throw AppError.badRequest('No active queue for this organization');
    const queue = queues[0];

    // Validate + fetch all products
    const productRows = await Promise.all(
      dto.items.map(async (item) => {
        const p = await productsRepository.findById(item.productId);
        if (!p) throw AppError.notFound(`Product ${item.productId} not found`);
        if (p.organization_id !== org.id)
          throw AppError.badRequest('Product does not belong to this organization');
        if (!p.is_active) throw AppError.badRequest(`Product "${p.name}" is not available`);
        const price = Number.parseFloat(p.price);
        return { product: p, quantity: item.quantity, price };
      })
    );

    const subtotal = productRows.reduce((sum, { price, quantity }) => sum + price * quantity, 0);
    const paymentTransaction = dto.payment?.transactionId
      ? await paymentTransactionsRepository.findById(dto.payment.transactionId)
      : null;
    if (dto.payment?.transactionId && !paymentTransaction) {
      throw AppError.badRequest('Verified payment transaction was not found');
    }
    if (paymentTransaction) {
      if (paymentTransaction.organization_id !== org.id) {
        throw AppError.badRequest('Payment transaction does not belong to this organization');
      }
      if (paymentTransaction.order_id) {
        throw AppError.conflict('Payment transaction has already been used');
      }
      if (paymentTransaction.status !== 'paid') {
        throw AppError.badRequest('Payment transaction has not been verified as paid');
      }
    }

    const paymentMetadata = paymentTransaction ? transactionMetadata(paymentTransaction) : null;
    const coveredProductIds = new Set(paymentMetadata?.coveredProductIds ?? []);
    const requiredProductIds = productRows
      .filter(({ product }) => product.requires_prepayment)
      .map(({ product }) => product.id);
    const missingRequiredPrepayment = requiredProductIds.filter((id) => !coveredProductIds.has(id));

    if (missingRequiredPrepayment.length > 0) {
      throw AppError.badRequest('Prepayment is required for one or more selected products');
    }

    const paidSubtotal = productRows.reduce((sum, { product, price, quantity }) => {
      return coveredProductIds.has(product.id) ? sum + price * quantity : sum;
    }, 0);
    if (paymentMetadata) {
      for (const { product, quantity, price } of productRows) {
        if (!coveredProductIds.has(product.id)) continue;
        const metadataItem = paymentMetadata.items?.find((item) => item.productId === product.id);
        if (
          !metadataItem ||
          metadataItem.quantity !== quantity ||
          metadataItem.subtotal !== price * quantity
        ) {
          throw AppError.badRequest('Payment transaction does not match the selected cart');
        }
      }
    }
    if (paymentTransaction && Number(paymentTransaction.amount) < paidSubtotal) {
      throw AppError.badRequest('Payment transaction amount does not cover selected items');
    }

    const isFullyPaid = paymentMetadata?.scope === 'all_items' && paidSubtotal >= subtotal;
    const orderPaymentStatus = isFullyPaid ? 'paid' : 'unpaid';

    // Create queue entry + order + items in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockedQueue = await queuesRepository.lockById(queue.id, client);
      if (!lockedQueue || lockedQueue.status !== 'open') {
        throw AppError.conflict('Queue is not accepting entries');
      }
      if (lockedQueue.max_capacity !== null) {
        const activeCount = await queuesRepository.countWaiting(queue.id, client);
        if (activeCount >= lockedQueue.max_capacity) {
          throw AppError.conflict('Queue is at full capacity');
        }
      }

      const { ticketNumber, businessDate } = await queuesRepository.incrementAndGetCounter(
        queue.id,
        client
      );
      const ticketCode = `${queue.prefix ?? ''}${String(ticketNumber).padStart(3, '0')}`;

      if (dto.bookingGroupId) {
        await ordersRepository.ensureBookingGroup(
          {
            id: dto.bookingGroupId,
            organizationId: org.id,
            customerUserId: actorUserId,
            localDeviceKey: dto.localDeviceKey,
          },
          client
        );
      }

      // Create queue entry (link to user if authenticated)
      const entry = await queueEntriesRepository.create(
        {
          queueId: queue.id,
          ticketNumber,
          ticketCode,
          businessDate,
          userId: actorUserId,
          lineUserId: actor?.lineUserId,
        },
        client
      );

      const nextOrderNumber = await ordersRepository.nextOrderNumber(org.id, client);
      const orderNum = formatOrderNumber(queue.prefix ?? 'O', nextOrderNumber);

      // Create order (within transaction) — include customer linkage fields
      const order = await ordersRepository.create(
        {
          organizationId: org.id,
          orderNumber: orderNum,
          customerName: dto.customerName,
          customerUserId: actorUserId,
          customerPhone: dto.customerPhone,
          subtotal,
          bookingGroupId: dto.bookingGroupId,
          paymentStatus: orderPaymentStatus,
          paymentCode:
            paymentTransaction?.external_transaction_id ??
            paymentTransaction?.payment_intent_id ??
            undefined,
          notes: dto.notes,
        },
        client
      );

      const paymentTransactionId = paymentTransaction?.id ?? null;
      if (paymentTransactionId) {
        await paymentTransactionsRepository.attachToOrder(paymentTransactionId, order.id, client);
      }

      const linkedEntry = await queueEntriesRepository.linkOrder(entry.id, order.id, client);
      const linkedOrder = { ...order, queue_entry_id: linkedEntry.id };

      if (dto.customerLocation) {
        const orgWithLocation = org as typeof org & {
          latitude?: string | number | null;
          longitude?: string | number | null;
        };
        const orgLatitude = nullableNumber(orgWithLocation.latitude);
        const orgLongitude = nullableNumber(orgWithLocation.longitude);
        const distanceToOrgMeters =
          orgLatitude !== null && orgLongitude !== null
            ? distanceMeters(dto.customerLocation, {
                latitude: orgLatitude,
                longitude: orgLongitude,
              })
            : null;

        const savedLocation = await ordersRepository.createCustomerLocation(
          {
            organizationId: org.id,
            queueEntryId: linkedEntry.id,
            customerUserId: actorUserId,
            localDeviceKey: dto.localDeviceKey,
            latitude: dto.customerLocation.latitude,
            longitude: dto.customerLocation.longitude,
            accuracyMeters: dto.customerLocation.accuracyMeters,
            distanceToOrgMeters,
          },
          client
        );

        const alertThresholdMeters = 1000;
        if (distanceToOrgMeters !== null && distanceToOrgMeters > alertThresholdMeters) {
          await ordersRepository.createLocationAlert(
            {
              organizationId: org.id,
              queueEntryId: linkedEntry.id,
              customerLocationId: savedLocation.id,
              distanceToOrgMeters,
              thresholdMeters: alertThresholdMeters,
              dueAt: new Date(),
              rawPayload: {
                queueId: queue.id,
                ticketNumber,
                ticketCode,
                notifyAheadPositions: queue.notify_ahead_positions,
                avgServiceSeconds: queue.avg_service_seconds,
              },
            },
            client
          );
        }
      }

      // Create items (within transaction)
      for (const { product, quantity, price } of productRows) {
        const itemPaid = coveredProductIds.has(product.id);
        await ordersRepository.createItem(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            productPrice: price,
            serviceTimeMinutes: product.service_time_minutes,
            quantity,
            subtotal: price * quantity,
            paymentStatus: itemPaid ? 'paid' : 'unpaid',
            prepaidAmount: itemPaid ? price * quantity : 0,
            paymentTransactionId: itemPaid ? paymentTransactionId : null,
            requiresPrepaymentSnapshot: product.requires_prepayment,
          },
          client
        );

        if (product.stock_quantity !== null) {
          await inventoryService.reserveFiniteProduct(
            {
              organizationId: org.id,
              orderId: order.id,
              productId: product.id,
              quantity,
              actorId: actorUserId,
            },
            client
          );
        }
      }

      const aheadCount = await getWaitingPositionInTransaction(client, linkedEntry);
      await queueNotificationService.notifyBookingCreated(
        linkedEntry,
        {
          organizationId: org.id,
          aheadCount,
          estimatedWaitSeconds: etaService.calculate({
            aheadCount,
            avgServiceSeconds: queue.avg_service_seconds,
          }).estimatedWaitSeconds,
        },
        notificationOutboxRepository,
        client
      );

      await client.query('COMMIT');
      productCatalogCache.invalidate(`org:${org.id}`);
      productCatalogCache.invalidate(`slug:${org.slug}`);
      return { order: linkedOrder, entry: linkedEntry };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateStatus(id: string, orgId: string, dto: UpdateOrderStatusDto) {
    const order = await ordersRepository.findById(id);
    if (!order) throw AppError.notFound('Order not found');
    if (order.organization_id !== orgId) throw AppError.forbidden();
    const updated = await ordersRepository.updateStatus(id, dto.status);
    if (!updated) throw AppError.notFound('Order not found');
    return updated;
  },

  async updatePayment(id: string, orgId: string, dto: UpdateOrderPaymentDto) {
    const order = await ordersRepository.findById(id);
    if (!order) throw AppError.notFound('Order not found');
    if (order.organization_id !== orgId) throw AppError.forbidden();
    const updated = await ordersRepository.updatePayment(id, dto.paymentStatus);
    if (!updated) throw AppError.notFound('Order not found');
    return updated;
  },

  /**
   * Public cancel — customer cancels their own order.
   * For anonymous orders (no customer_user_id), allow cancel by orderId only.
   * For authenticated orders, the actorUserId must match.
   */
  async cancelByOrderId(
    orderId: string,
    actor?: string | { userId: string; role: string; organizationId?: string }
  ) {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw AppError.notFound('Order not found');

    if (!actor) throw AppError.unauthorized();
    const resolvedActor = typeof actor === 'string' ? { userId: actor, role: 'customer' } : actor;

    const isOperator = ['staff', 'manager', 'admin'].includes(resolvedActor.role);
    if (isOperator) {
      if (!resolvedActor.organizationId || order.organization_id !== resolvedActor.organizationId) {
        throw AppError.forbidden('Order is outside your organization');
      }
    } else if (!order.customer_user_id || order.customer_user_id !== resolvedActor.userId) {
      throw AppError.forbidden('You do not own this order');
    }

    if (!['pending', 'processing'].includes(order.status)) {
      throw AppError.conflict(`Order cannot be cancelled from status '${order.status}'`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await ordersRepository.updateStatus(orderId, 'cancelled', client);
      if (!updated) throw AppError.notFound('Order not found');
      await inventoryService.releaseOrder(orderId, client, 'order_cancelled', resolvedActor.userId);

      if (order.queue_entry_id) {
        const linkedEntry = await queueEntriesRepository.findById(order.queue_entry_id, client);
        if (linkedEntry && ['waiting', 'called'].includes(linkedEntry.status)) {
          const cancelledEntry = await queueEntriesRepository.markCancelled(
            order.queue_entry_id,
            client
          );
          await queueNotificationService.notifyTicketCancelled(
            cancelledEntry,
            { organizationId: order.organization_id },
            notificationOutboxRepository,
            client
          );
        }
      }

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
