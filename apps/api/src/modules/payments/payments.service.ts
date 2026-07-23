import type { IncomingHttpHeaders } from 'node:http';

import { pool } from '../../db/client';
import type { PaymentTransactionRow } from '../../db/repositories/orders.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { AppError } from '../../utils/AppError';

import { getPaymentProvider } from './payment-provider.registry';
import {
  PaymentIntentMetadata,
  PaymentProviderId,
  PaymentScope,
  PaymentState,
} from './payments.types';
import { CreatePaymentIntentDto } from './payments.validator';
import { demoPaymentProvider } from './providers/demo-payment.provider';

function amountNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metadataFromTransaction(transaction: PaymentTransactionRow): PaymentIntentMetadata {
  const metadata = transaction.metadata ?? {};
  return metadata as unknown as PaymentIntentMetadata;
}

async function loadIntentProducts(orgId: string, items: CreatePaymentIntentDto['items']) {
  return Promise.all(
    items.map(async (item) => {
      const product = await productsRepository.findById(item.productId);
      if (!product) throw AppError.notFound(`Product ${item.productId}`);
      if (product.organization_id !== orgId) {
        throw AppError.badRequest('Product does not belong to this organization');
      }
      if (!product.is_active)
        throw AppError.badRequest(`Product "${product.name}" is not available`);
      if (product.stock_quantity !== null && item.quantity > product.stock_quantity) {
        throw AppError.conflict(`Insufficient stock for "${product.name}"`);
      }
      const unitPrice = amountNumber(product.price);
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    })
  );
}

function resolveCoveredProductIds(
  scope: PaymentScope,
  rows: Awaited<ReturnType<typeof loadIntentProducts>>
): string[] {
  if (scope === 'all_items') return rows.map(({ product }) => product.id);
  return rows.filter(({ product }) => product.requires_prepayment).map(({ product }) => product.id);
}

function paymentTimestamp(status: PaymentState) {
  return {
    status,
    rawPayload: { stateChangedBy: 'payment-service' },
  };
}

const ALLOWED_TRANSITIONS: Record<PaymentState, ReadonlySet<PaymentState>> = {
  pending: new Set(['pending', 'authorized', 'paid', 'failed', 'cancelled']),
  authorized: new Set(['authorized', 'paid', 'failed', 'cancelled']),
  paid: new Set(['paid', 'refunded']),
  failed: new Set(['failed', 'paid']),
  cancelled: new Set(['cancelled', 'paid']),
  refunded: new Set(['refunded']),
};

export function canApplyPaymentEvent(
  current: PaymentState,
  next: PaymentState,
  previousEventAt?: Date | null,
  eventAt?: Date
): boolean {
  if (!ALLOWED_TRANSITIONS[current].has(next)) return false;
  return !previousEventAt || !eventAt || eventAt >= previousEventAt;
}

export function resolveRefundState(
  transactionAmount: number,
  requestedRefundedAmount?: number
): { status: PaymentState; refundedAmount: number } {
  const refundedAmount = Math.min(transactionAmount, requestedRefundedAmount ?? transactionAmount);
  return {
    status: refundedAmount < transactionAmount ? 'paid' : 'refunded',
    refundedAmount,
  };
}

function safeProviderPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value))
    return value.slice(0, 50).map((item) => safeProviderPayload(item, depth + 1));
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.slice(0, 1000) : value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|authorization|password|card|credential/i.test(key)) {
      result[key] = '[redacted]';
    } else {
      result[key] = safeProviderPayload(item, depth + 1);
    }
  }
  return result;
}

export const paymentsService = {
  async createIntent(dto: CreatePaymentIntentDto) {
    const org = await organizationsRepository.findBySlug(dto.orgSlug);
    if (!org) throw AppError.notFound('Organization');

    const rows = await loadIntentProducts(org.id, dto.items);
    const coveredProductIds = resolveCoveredProductIds(dto.scope, rows);
    if (coveredProductIds.length === 0) {
      throw AppError.badRequest('No payable items were selected');
    }

    const amount = rows.reduce((sum, row) => {
      return coveredProductIds.includes(row.product.id) ? sum + row.subtotal : sum;
    }, 0);
    if (amount <= 0) throw AppError.badRequest('Payment amount must be greater than zero');

    const providerId = dto.provider as PaymentProviderId;
    const provider = getPaymentProvider(providerId);
    const effectiveProviderId = provider.provider;
    const metadata: PaymentIntentMetadata = {
      orgSlug: org.slug,
      scope: dto.scope,
      coveredProductIds,
      cartSignature: dto.cartSignature,
      items: rows.map((row) => ({
        productId: row.product.id,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        subtotal: row.subtotal,
        requiresPrepayment: row.product.requires_prepayment,
      })),
    };

    const transaction = await paymentTransactionsRepository.createIntent({
      organizationId: org.id,
      provider: effectiveProviderId,
      method: dto.method,
      status: 'pending',
      amount,
      currency: dto.currency,
      returnUrl: dto.returnUrl,
      metadata: metadata as unknown as Record<string, unknown>,
      rawPayload: { requestedProvider: providerId },
    });

    const intent = await provider.createPaymentIntent({
      transactionId: transaction.id,
      amount,
      currency: dto.currency,
      method: dto.method,
      returnUrl: dto.returnUrl,
      metadata,
    });

    const updated = await paymentTransactionsRepository.updateProviderIntent(transaction.id, {
      paymentIntentId: intent.providerIntentId,
      externalTransactionId: intent.providerIntentId,
      checkoutUrl: intent.checkoutUrl,
      status: intent.status,
      rawPayload: intent.rawPayload,
    });

    return {
      transactionId: transaction.id,
      provider: effectiveProviderId,
      method: transaction.method,
      status: updated?.status ?? intent.status,
      amount,
      currency: dto.currency,
      checkoutUrl: intent.checkoutUrl,
      demoToken: intent.demoToken,
      coveredProductIds,
      scope: dto.scope,
    };
  },

  async getReturnStatus(transactionId: string) {
    const transaction = await paymentTransactionsRepository.findById(transactionId);
    if (!transaction) throw AppError.notFound('Payment transaction');

    const provider = getPaymentProvider(transaction.provider as PaymentProviderId);
    const providerStatus = await provider.retrievePaymentStatus(transaction.id);
    if (providerStatus.status !== 'pending' && providerStatus.status !== transaction.status) {
      await paymentTransactionsRepository.updateStatus(transaction.id, {
        ...paymentTimestamp(providerStatus.status),
        providerIntentId: providerStatus.providerIntentId,
        rawPayload: providerStatus.rawPayload,
      });
    }

    const current = await paymentTransactionsRepository.findById(transactionId);
    return this.toPublicTransaction(current ?? transaction);
  },

  async completeDemoPayment(transactionId: string, demoToken: string) {
    const transaction = await paymentTransactionsRepository.findById(transactionId);
    if (!transaction) throw AppError.notFound('Payment transaction');
    if (transaction.provider !== 'demo') throw AppError.badRequest('Payment provider is not demo');

    const verified = demoPaymentProvider.verifyDemoCompletionToken(
      transaction.id,
      transaction.amount,
      transaction.currency,
      demoToken
    );
    if (!verified) throw AppError.unauthorized('Invalid demo payment token');

    const eventId = `demo-return-${transaction.id}`;
    await this.applyProviderEvent('demo', {
      eventId,
      eventType: 'demo.payment.paid',
      transactionId: transaction.id,
      providerIntentId: transaction.payment_intent_id ?? undefined,
      status: 'paid',
      rawPayload: { eventId, transactionId: transaction.id, status: 'paid', source: 'demo-return' },
    });

    const current = await paymentTransactionsRepository.findById(transactionId);
    return this.toPublicTransaction(current ?? transaction);
  },

  async handleWebhook(
    providerId: PaymentProviderId,
    rawBody: Buffer,
    headers: IncomingHttpHeaders
  ) {
    const provider = getPaymentProvider(providerId);
    const signatureValid = provider.verifyWebhookSignature(rawBody, headers);
    if (!signatureValid) throw AppError.unauthorized('Invalid payment webhook signature');
    const event = provider.parseWebhookPayload(rawBody);
    return this.applyProviderEvent(provider.provider, event, signatureValid);
  },

  async applyProviderEvent(
    providerId: PaymentProviderId,
    event: {
      eventId: string;
      eventType: string;
      transactionId: string;
      providerIntentId?: string;
      status: PaymentState;
      occurredAt?: Date;
      refundedAmount?: number;
      rawPayload: Record<string, unknown>;
    },
    signatureValid = true
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const transaction = await paymentTransactionsRepository.findByIdForUpdate(
        event.transactionId,
        client
      );
      if (!transaction) throw AppError.notFound('Payment transaction');
      const safePayload = safeProviderPayload(event.rawPayload) as Record<string, unknown>;

      const { inserted } = await paymentTransactionsRepository.insertWebhookEvent(
        {
          provider: providerId,
          eventId: event.eventId,
          eventType: event.eventType,
          paymentTransactionId: transaction.id,
          signatureValid,
          rawPayload: safePayload,
        },
        client
      );

      if (!inserted) {
        await client.query('COMMIT');
        return { duplicate: true, transaction: this.toPublicTransaction(transaction) };
      }

      const eventAt = event.occurredAt ?? new Date();
      const previousEventAt = transaction.last_provider_event_at
        ? new Date(transaction.last_provider_event_at)
        : null;
      const requestedStatus = event.status;
      const transitionAllowed =
        ALLOWED_TRANSITIONS[transaction.status as PaymentState].has(requestedStatus);
      const outOfOrder = previousEventAt !== null && eventAt < previousEventAt;

      if (!transitionAllowed || outOfOrder) {
        await paymentTransactionsRepository.recordReconciliation(
          {
            organizationId: transaction.organization_id,
            transactionId: transaction.id,
            orderId: transaction.order_id,
            source: providerId === 'demo' ? 'demo' : 'webhook',
            operationType: outOfOrder ? 'ignored_out_of_order' : 'ignored_transition',
            fromStatus: transaction.status,
            toStatus: requestedStatus,
            idempotencyKey: `webhook:${providerId}:${event.eventId}`,
          },
          client
        );
        await paymentTransactionsRepository.markWebhookProcessed(
          providerId,
          event.eventId,
          'processed',
          undefined,
          client
        );
        await client.query('COMMIT');
        return {
          duplicate: false,
          ignored: true,
          transaction: this.toPublicTransaction(transaction),
        };
      }

      const transactionAmount = amountNumber(transaction.amount);
      const currentRefunded = amountNumber(transaction.refunded_amount ?? 0);
      const requestedRefunded =
        requestedStatus === 'refunded'
          ? Math.min(transactionAmount, event.refundedAmount ?? transactionAmount)
          : currentRefunded;
      const effectiveStatus: PaymentState =
        requestedStatus === 'refunded' && requestedRefunded < transactionAmount
          ? 'paid'
          : requestedStatus;

      const updated = await paymentTransactionsRepository.updateStatus(
        transaction.id,
        {
          status: effectiveStatus,
          providerIntentId: event.providerIntentId,
          rawPayload: safePayload,
          refundedAmount: requestedRefunded,
          providerEventAt: eventAt,
        },
        client
      );

      if (updated?.order_id) {
        await this.reconcileTransactionInClient(updated, client);
      }

      await paymentTransactionsRepository.recordReconciliation(
        {
          organizationId: transaction.organization_id,
          transactionId: transaction.id,
          orderId: transaction.order_id,
          source: providerId === 'demo' ? 'demo' : 'webhook',
          operationType:
            requestedStatus === 'refunded' && effectiveStatus === 'paid'
              ? 'partial_refund'
              : 'state_transition',
          fromStatus: transaction.status,
          toStatus: effectiveStatus,
          amount: requestedStatus === 'refunded' ? requestedRefunded : transactionAmount,
          idempotencyKey: `webhook:${providerId}:${event.eventId}`,
        },
        client
      );

      await paymentTransactionsRepository.markWebhookProcessed(
        providerId,
        event.eventId,
        'processed',
        undefined,
        client
      );
      await client.query('COMMIT');
      return { duplicate: false, transaction: this.toPublicTransaction(updated ?? transaction) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async reconcile(transactionId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const transaction = await paymentTransactionsRepository.findById(transactionId, client);
      if (!transaction) throw AppError.notFound('Payment transaction');
      await this.reconcileTransactionInClient(transaction, client);
      await client.query('COMMIT');
      return this.toPublicTransaction(transaction);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async manualReconcileOrder(params: {
    orderId: string;
    organizationId: string;
    actorId: string;
    status: 'paid' | 'refunded';
    amount?: number;
    reason?: string;
    idempotencyKey: string;
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query<{
        id: string;
        organization_id: string;
        subtotal: string;
        payment_status: string;
      }>(
        `SELECT id, organization_id, subtotal, payment_status
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [params.orderId]
      );
      const order = orderResult.rows[0];
      if (!order) throw AppError.notFound('Order');
      if (order.organization_id !== params.organizationId) throw AppError.forbidden();

      let transaction = await paymentTransactionsRepository.findLatestByOrder(order.id, client);
      if (!transaction) {
        if (params.status === 'refunded' && order.payment_status !== 'paid') {
          throw AppError.conflict('A paid transaction is required before refund');
        }
        const itemResult = await client.query<{ product_id: string }>(
          `SELECT DISTINCT product_id
           FROM order_items
           WHERE order_id = $1
           ORDER BY product_id`,
          [order.id]
        );
        transaction = await paymentTransactionsRepository.createManual(
          {
            organizationId: order.organization_id,
            orderId: order.id,
            amount: amountNumber(order.subtotal),
            method: 'cash_or_terminal',
            coveredProductIds: itemResult.rows.map((item) => item.product_id),
          },
          client
        );
        if (params.status === 'refunded') {
          await this.reconcileTransactionInClient(transaction, client);
          await paymentTransactionsRepository.recordReconciliation(
            {
              organizationId: order.organization_id,
              transactionId: transaction.id,
              orderId: order.id,
              actorId: params.actorId,
              source: 'manual',
              operationType: 'legacy_paid_backfill',
              fromStatus: order.payment_status,
              toStatus: 'paid',
              amount: amountNumber(order.subtotal),
              idempotencyKey: `${params.idempotencyKey}:paid-backfill`,
              reason: 'Backfilled missing transaction before staff refund',
            },
            client
          );
        }
      }

      const total = amountNumber(transaction.amount);
      const currentRefunded = amountNumber(transaction.refunded_amount ?? 0);
      const refundAmount =
        params.status === 'refunded'
          ? Math.min(total, Math.max(currentRefunded, params.amount ?? total))
          : currentRefunded;
      const effectiveStatus: PaymentState =
        params.status === 'refunded' && refundAmount < total ? 'paid' : params.status;
      const inserted = await paymentTransactionsRepository.recordReconciliation(
        {
          organizationId: order.organization_id,
          transactionId: transaction.id,
          orderId: order.id,
          actorId: params.actorId,
          source: 'manual',
          operationType:
            params.status === 'refunded' && effectiveStatus === 'paid'
              ? 'partial_refund'
              : 'manual_state_transition',
          fromStatus: transaction.status,
          toStatus: effectiveStatus,
          amount: params.status === 'refunded' ? refundAmount : total,
          idempotencyKey: params.idempotencyKey,
          reason: params.reason,
        },
        client
      );
      if (!inserted) {
        await client.query('COMMIT');
        return this.toPublicTransaction(transaction);
      }

      const updated = await paymentTransactionsRepository.updateStatus(
        transaction.id,
        {
          status: effectiveStatus,
          refundedAmount: refundAmount,
          rawPayload: { source: 'staff_manual' },
        },
        client
      );
      if (updated) await this.reconcileTransactionInClient(updated, client);
      await client.query('COMMIT');
      return this.toPublicTransaction(updated ?? transaction);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async reconcileTransactionInClient(
    transaction: PaymentTransactionRow,
    client: import('pg').PoolClient
  ) {
    if (!transaction.order_id) return;
    const metadata = metadataFromTransaction(transaction);
    const coveredProductIds = new Set(metadata.coveredProductIds ?? []);
    const paid = transaction.status === 'paid';
    const refundedAmount = amountNumber(transaction.refunded_amount ?? 0);

    await client.query(
      `UPDATE order_items
       SET payment_status = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN 'paid'::payment_status ELSE payment_status END,
           prepaid_amount = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN subtotal ELSE prepaid_amount END,
           payment_transaction_id = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN $1 ELSE payment_transaction_id END
       WHERE order_id = $4`,
      [transaction.id, Array.from(coveredProductIds), paid, transaction.order_id]
    );

    if (paid && metadata.scope === 'all_items') {
      await client.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1`, [
        transaction.order_id,
      ]);
    }

    if (refundedAmount > 0) {
      const { rows } = await client.query<{
        id: string;
        prepaid_amount: string;
      }>(
        `SELECT id, prepaid_amount
         FROM order_items
         WHERE order_id = $1 AND payment_transaction_id = $2
         ORDER BY id
         FOR UPDATE`,
        [transaction.order_id, transaction.id]
      );
      let remaining = refundedAmount;
      for (const item of rows) {
        const prepaid = amountNumber(item.prepaid_amount);
        const allocation = Math.min(prepaid, remaining);
        remaining -= allocation;
        await client.query(
          `UPDATE order_items
           SET refunded_amount = $2,
               payment_status = CASE
                 WHEN $2 >= prepaid_amount THEN 'refunded'::payment_status
                 ELSE 'paid'::payment_status
               END
           WHERE id = $1`,
          [item.id, allocation]
        );
      }
      await client.query(
        `UPDATE orders
         SET refunded_amount = $2,
             payment_status = CASE
               WHEN $2 >= subtotal AND $3 = 'all_items' THEN 'refunded'::payment_status
               ELSE 'paid'::payment_status
             END
         WHERE id = $1`,
        [transaction.order_id, refundedAmount, metadata.scope ?? 'required_items']
      );
    }
  },

  toPublicTransaction(transaction: PaymentTransactionRow) {
    const metadata = metadataFromTransaction(transaction);
    return {
      id: transaction.id,
      provider: transaction.provider,
      method: transaction.method,
      status: transaction.status,
      amount: amountNumber(transaction.amount),
      currency: transaction.currency,
      checkoutUrl: transaction.checkout_url ?? transaction.redirect_url,
      returnUrl: transaction.return_url,
      scope: metadata.scope,
      coveredProductIds: metadata.coveredProductIds ?? [],
      paidAt: transaction.paid_at,
      refundedAmount: amountNumber(transaction.refunded_amount ?? 0),
      updatedAt: transaction.updated_at,
    };
  },
};
