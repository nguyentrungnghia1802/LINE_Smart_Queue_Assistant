import { pool } from '../../db/client';
import { ordersRepository } from '../../db/repositories/orders.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';

import { CreateOrderDto, UpdateOrderPaymentDto, UpdateOrderStatusDto } from './orders.validator';

function formatOrderNumber(prefix: string, count: number): string {
  return `${prefix}${String(count).padStart(3, '0')}`;
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

  async create(dto: CreateOrderDto, actorUserId?: string) {
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

    // Create queue entry + order + items in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Increment ticket counter
      const ticketNumber = await queuesRepository.incrementAndGetCounter(queue.id, client);
      const ticketCode = `${queue.prefix ?? ''}${String(ticketNumber).padStart(3, '0')}`;

      // Create queue entry (link to user if authenticated)
      const entry = await queueEntriesRepository.create(
        {
          queueId: queue.id,
          ticketNumber,
          ticketCode,
          userId: actorUserId,
        },
        client
      );

      // Count orders for this org to get order number
      const { rows: countRows } = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM orders WHERE organization_id = $1`,
        [org.id]
      );
      const orderNum = formatOrderNumber(
        queue.prefix ?? 'O',
        Number.parseInt(countRows[0].count, 10) + 1
      );

      // Create order (within transaction) — include customer linkage fields
      const order = await ordersRepository.create(
        {
          organizationId: org.id,
          orderNumber: orderNum,
          customerName: dto.customerName,
          customerUserId: actorUserId,
          customerPhone: dto.customerPhone,
          subtotal,
          notes: dto.notes,
        },
        client
      );

      const linkedEntry = await queueEntriesRepository.linkOrder(entry.id, order.id, client);
      const linkedOrder = { ...order, queue_entry_id: linkedEntry.id };

      // Create items (within transaction)
      for (const { product, quantity, price } of productRows) {
        await ordersRepository.createItem(
          {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            productPrice: price,
            serviceTimeMinutes: product.service_time_minutes,
            quantity,
            subtotal: price * quantity,
          },
          client
        );
      }

      await client.query('COMMIT');
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

    // Cancel order
    const updated = await ordersRepository.updateStatus(orderId, 'cancelled');

    // Also cancel the linked queue entry if present
    if (order.queue_entry_id) {
      try {
        await queueEntriesRepository.markCancelled(order.queue_entry_id);
      } catch {
        // Entry may already be cancelled or in a non-cancellable state — not fatal
      }
    }

    return updated;
  },
};
