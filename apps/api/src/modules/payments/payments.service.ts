import type { IncomingHttpHeaders } from 'node:http';

import { config } from '../../config';
import { pool } from '../../db/client';
import type { PaymentTransactionRow } from '../../db/repositories/orders.repository';
import { ordersRepository } from '../../db/repositories/orders.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import type { BranchManagerScope } from '../branches/branch-scope';
import { branchesRepository } from '../branches/branches.repository';

import { getPaymentProvider } from './payment-provider.registry';
import {
  PaymentIntentMetadata,
  PaymentProviderId,
  PaymentScope,
  PaymentState,
} from './payments.types';
import { CreatePaymentIntentDto } from './payments.validator';
import { demoPaymentProvider } from './providers/demo-payment.provider';

function amountNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function trustedReturnUrl(requestedUrl?: string): string {
  const configuredOrigin = new URL(config.web.origin);
  if (!requestedUrl) return configuredOrigin.toString();
  const requested = new URL(requestedUrl);
  if (requested.origin !== configuredOrigin.origin) {
    throw AppError.badRequest('Payment return URL must use the application origin');
  }
  return requested.toString();
}

function metadataFromTransaction(transaction: PaymentTransactionRow): PaymentIntentMetadata {
  const metadata = transaction.metadata ?? {};
  return metadata as unknown as PaymentIntentMetadata;
}

async function loadIntentProducts(
  orgId: string,
  items: CreatePaymentIntentDto['items'],
  queueProducts: Map<string, Awaited<ReturnType<typeof productsRepository.findByQueue>>[number]>
) {
  return Promise.all(
    items.map(async (item) => {
      const product = queueProducts.get(item.productId);
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
    const queue = await queuesRepository.findById(dto.queueId);
    if (
      !queue ||
      queue.organization_id !== org.id ||
      queue.branch_id !== dto.branchId ||
      queue.status !== 'open'
    ) {
      throw new AppError('No queue is currently accepting bookings', 409, 'QUEUE_NOT_ACCEPTING');
    }
    if (!(await branchesRepository.isOpenNow(dto.branchId))) {
      throw new AppError('Branch is outside business hours', 409, 'BRANCH_CLOSED');
    }

    const queueProductRows = await productsRepository.findByQueue(dto.queueId);
    const queueProducts = new Map(queueProductRows.map((product) => [product.id, product]));
    const rows = await loadIntentProducts(org.id, dto.items, queueProducts);
    const queueProductIds = new Set(queueProductRows.map((product) => product.id));
    if (rows.some((row) => !queueProductIds.has(row.product.id))) {
      throw AppError.badRequest('One or more products are unavailable in the selected queue');
    }
    const coveredProductIds = resolveCoveredProductIds(dto.scope, rows);
    if (coveredProductIds.length === 0) {
      throw AppError.badRequest('No payable items were selected');
    }

    const amount = rows.reduce((sum, row) => {
      return coveredProductIds.includes(row.product.id) ? sum + row.subtotal : sum;
    }, 0);
    if (amount <= 0) throw AppError.badRequest('Payment amount must be greater than zero');

    const providerId = dto.provider as PaymentProviderId;
    if (config.payments.mode === 'external' && providerId === 'payos') {
      const branch = await branchesRepository.findById(dto.branchId, org.id);
      const paymentSettings = branch?.payment_settings ?? {};
      if (
        paymentSettings['collectionProvider'] !== 'payos' ||
        paymentSettings['currencyCode'] !== 'VND' ||
        dto.currency !== 'VND'
      ) {
        throw new AppError(
          'This branch has not enabled payOS with VND',
          409,
          'BRANCH_PAYMENT_NOT_CONFIGURED'
        );
      }
    }
    const provider = getPaymentProvider(providerId);
    const effectiveProviderId = provider.provider;
    const returnUrl = trustedReturnUrl(dto.returnUrl);
    const metadata: PaymentIntentMetadata = {
      orgSlug: org.slug,
      branchId: dto.branchId,
      queueId: dto.queueId,
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
      returnUrl,
      metadata: metadata as unknown as Record<string, unknown>,
      rawPayload: { requestedProvider: providerId },
    });

    let intent;
    try {
      intent = await provider.createPaymentIntent({
        transactionId: transaction.id,
        amount,
        currency: dto.currency,
        method: dto.method,
        returnUrl,
        metadata,
      });
    } catch (error) {
      await paymentTransactionsRepository.updateStatus(transaction.id, {
        status: 'failed',
        rawPayload: {
          providerCreationFailed: true,
          errorCode: error instanceof AppError ? error.code : 'PAYMENT_PROVIDER_ERROR',
        },
      });
      throw error;
    }

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

  async createCounterPayment(params: {
    orderId: string;
    organizationId: string;
    branchId: string;
  }) {
    const order = await ordersRepository.findById(params.orderId);
    if (
      !order ||
      order.organization_id !== params.organizationId ||
      order.branch_id !== params.branchId
    ) {
      throw AppError.notFound('Order');
    }
    if (!['pending', 'processing'].includes(order.status)) {
      throw AppError.conflict('Only active orders can be paid');
    }

    const existing = await paymentTransactionsRepository.findLatestPendingByOrder(order.id);
    if (existing?.provider === 'payos') {
      return {
        transactionId: existing.id,
        status: existing.status,
        amount: amountNumber(existing.amount),
        currency: existing.currency,
        checkoutUrl: existing.checkout_url,
        qrCode: String(existing.raw_payload?.qrCode ?? ''),
      };
    }

    const branch = await branchesRepository.findById(params.branchId, params.organizationId);
    const paymentSettings = branch?.payment_settings ?? {};
    if (
      paymentSettings['collectionProvider'] !== 'payos' ||
      paymentSettings['currencyCode'] !== 'VND'
    ) {
      throw new AppError(
        'This branch has not enabled payOS with VND',
        409,
        'BRANCH_PAYMENT_NOT_CONFIGURED'
      );
    }
    const provider = getPaymentProvider('payos');
    if (provider.provider !== 'payos') {
      throw new AppError(
        'PAYMENT_MODE=external is required for counter QR payments',
        503,
        'PAYMENT_PROVIDER_NOT_CONFIGURED'
      );
    }
    const prepaid = order.items.reduce(
      (sum, item) =>
        sum + Math.max(0, amountNumber(item.prepaid_amount) - amountNumber(item.refunded_amount)),
      0
    );
    const amount = Math.max(0, amountNumber(order.subtotal) - prepaid);
    if (amount <= 0) throw AppError.conflict('The order has no outstanding balance');

    const metadata: PaymentIntentMetadata = {
      orgSlug: '',
      branchId: params.branchId,
      queueId: order.queue_id,
      scope: 'all_items',
      counterBalance: true,
      coveredProductIds: order.items.map((item) => item.product_id),
      items: order.items.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: amountNumber(item.product_price),
        subtotal: amountNumber(item.subtotal),
        requiresPrepayment: item.requires_prepayment_snapshot === true,
      })),
    };
    const transaction = await paymentTransactionsRepository.createIntent({
      organizationId: params.organizationId,
      provider: 'payos',
      method: 'vietqr_counter',
      status: 'pending',
      amount,
      currency: 'VND',
      returnUrl: `${config.web.origin.replace(/\/$/, '')}/staff`,
      metadata: metadata as unknown as Record<string, unknown>,
      rawPayload: { source: 'staff_counter' },
    });
    await paymentTransactionsRepository.attachToOrder(transaction.id, order.id);
    let intent;
    try {
      intent = await provider.createPaymentIntent({
        transactionId: transaction.id,
        amount,
        currency: 'VND',
        method: 'vietqr_counter',
        returnUrl: `${config.web.origin.replace(/\/$/, '')}/staff`,
        metadata,
      });
    } catch (error) {
      await paymentTransactionsRepository.updateStatus(transaction.id, {
        status: 'failed',
        rawPayload: {
          source: 'staff_counter',
          providerCreationFailed: true,
          errorCode: error instanceof AppError ? error.code : 'PAYMENT_PROVIDER_ERROR',
        },
      });
      throw error;
    }
    const updated = await paymentTransactionsRepository.updateProviderIntent(transaction.id, {
      paymentIntentId: intent.providerIntentId,
      externalTransactionId: intent.providerIntentId,
      checkoutUrl: intent.checkoutUrl,
      status: intent.status,
      rawPayload: intent.rawPayload,
    });
    return {
      transactionId: transaction.id,
      status: updated?.status ?? intent.status,
      amount,
      currency: 'VND',
      checkoutUrl: intent.checkoutUrl,
      qrCode: String(intent.rawPayload?.['qrCode'] ?? ''),
    };
  },

  async getReturnStatus(transactionId: string) {
    const transaction = await paymentTransactionsRepository.findById(transactionId);
    if (!transaction) throw AppError.notFound('Payment transaction');

    const provider = getPaymentProvider(transaction.provider as PaymentProviderId);
    const providerStatus = await provider.retrievePaymentStatus(
      transaction.payment_intent_id ?? transaction.id
    );
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
    if (config.payments.mode !== 'demo') {
      throw new AppError(
        'Demo payment is disabled when PAYMENT_MODE=external',
        409,
        'PAYMENT_PROVIDER_DISABLED'
      );
    }
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
    if (config.payments.mode === 'demo' && providerId !== 'demo') {
      throw new AppError(
        'External payment webhooks are disabled when PAYMENT_MODE=demo',
        409,
        'PAYMENT_PROVIDER_DISABLED'
      );
    }
    const provider = getPaymentProvider(providerId);
    const signatureValid = provider.verifyWebhookSignature(rawBody, headers);
    if (!signatureValid) throw AppError.unauthorized('Invalid payment webhook signature');
    const event = provider.parseWebhookPayload(rawBody);
    if (!event.transactionId && event.providerIntentId) {
      const transaction = await paymentTransactionsRepository.findByProviderIntent(
        provider.provider,
        event.providerIntentId
      );
      if (!transaction) throw AppError.notFound('Payment transaction');
      event.transactionId = transaction.id;
    }
    if (!event.transactionId) throw AppError.badRequest('Payment webhook has no transaction');
    return this.applyProviderEvent(
      provider.provider,
      { ...event, transactionId: event.transactionId },
      signatureValid
    );
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

  async reconcile(transactionId: string, scope?: BranchManagerScope) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const transaction = await paymentTransactionsRepository.findById(transactionId, client);
      if (!transaction) throw AppError.notFound('Payment transaction');
      if (scope) {
        const metadata = metadataFromTransaction(transaction);
        const orderScope = transaction.order_id
          ? await client.query<{ branch_id: string }>(
              `SELECT branch_id
               FROM orders
               WHERE id = $1
                 AND organization_id = $2`,
              [transaction.order_id, transaction.organization_id]
            )
          : null;
        const transactionBranchId = orderScope?.rows[0]?.branch_id ?? metadata.branchId;
        if (
          transaction.organization_id !== scope.organizationId ||
          transactionBranchId !== scope.branchId
        ) {
          throw AppError.forbidden('Payment transaction is outside your assigned branch');
        }
      }
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
      let createdManualBalance = false;

      if (params.status === 'paid' && order.payment_status !== 'paid') {
        const itemResult = await client.query<{
          product_id: string;
          subtotal: string;
          prepaid_amount: string;
          payment_status: string;
        }>(
          `SELECT product_id, subtotal, prepaid_amount, payment_status
           FROM order_items
           WHERE order_id = $1
             AND payment_status <> 'paid'::payment_status
           ORDER BY product_id
           FOR UPDATE`,
          [order.id]
        );
        if (itemResult.rows.length > 0) {
          const outstandingAmount = itemResult.rows.reduce(
            (sum, item) =>
              sum + Math.max(0, amountNumber(item.subtotal) - amountNumber(item.prepaid_amount)),
            0
          );
          transaction = await paymentTransactionsRepository.createManual(
            {
              organizationId: order.organization_id,
              orderId: order.id,
              amount: outstandingAmount,
              method: 'cash_or_terminal',
              coveredProductIds: itemResult.rows.map((item) => item.product_id),
            },
            client
          );
          createdManualBalance = true;
        }
      }

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
          operationType: createdManualBalance
            ? 'manual_balance_payment'
            : params.status === 'refunded' && effectiveStatus === 'paid'
              ? 'partial_refund'
              : 'manual_state_transition',
          fromStatus: createdManualBalance ? order.payment_status : transaction.status,
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

  async refundOrderOnCancellationInClient(params: {
    orderId: string;
    organizationId: string;
    actorId?: string;
    reason: string;
    client: import('pg').PoolClient;
  }): Promise<{ refundedAmount: number; transactionCount: number }> {
    const orderResult = await params.client.query<{
      id: string;
      organization_id: string;
    }>(
      `SELECT id, organization_id
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [params.orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw AppError.notFound('Order');
    if (order.organization_id !== params.organizationId) throw AppError.forbidden();

    const transactions = await paymentTransactionsRepository.findRefundableByOrderForUpdate(
      params.orderId,
      params.client
    );
    let refundedAmount = 0;
    let transactionCount = 0;

    for (const transaction of transactions) {
      const amount = amountNumber(transaction.amount);
      const alreadyRefunded = amountNumber(transaction.refunded_amount ?? 0);
      const remainingRefund = Math.max(0, amount - alreadyRefunded);
      if (remainingRefund === 0) continue;

      const idempotencyKey = `automatic-cancellation-refund:${params.orderId}:${transaction.id}`;
      const inserted = await paymentTransactionsRepository.recordReconciliation(
        {
          organizationId: params.organizationId,
          transactionId: transaction.id,
          orderId: params.orderId,
          actorId: params.actorId,
          source: 'reconciliation',
          operationType: 'automatic_cancellation_refund',
          fromStatus: transaction.status,
          toStatus: 'refunded',
          amount: remainingRefund,
          idempotencyKey,
          reason: params.reason,
        },
        params.client
      );
      if (!inserted) continue;

      const updated = await paymentTransactionsRepository.updateStatus(
        transaction.id,
        {
          status: 'refunded',
          refundedAmount: amount,
          rawPayload: { source: 'automatic_cancellation' },
        },
        params.client
      );
      if (!updated) throw AppError.notFound('Payment transaction');
      await this.reconcileTransactionInClient(updated, params.client);
      refundedAmount += remainingRefund;
      transactionCount += 1;
    }

    return { refundedAmount, transactionCount };
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

    if (metadata.counterBalance && paid) {
      await client.query(
        `UPDATE order_items
         SET payment_transaction_id = CASE
               WHEN payment_status <> 'paid'::payment_status THEN $1
               ELSE payment_transaction_id
             END,
             payment_status = 'paid'::payment_status,
             prepaid_amount = subtotal
         WHERE order_id = $2`,
        [transaction.id, transaction.order_id]
      );
    } else {
      await client.query(
        `UPDATE order_items
         SET payment_status = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN 'paid'::payment_status ELSE payment_status END,
             prepaid_amount = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN subtotal ELSE prepaid_amount END,
             payment_transaction_id = CASE WHEN $3::boolean AND product_id = ANY($2::uuid[]) THEN $1 ELSE payment_transaction_id END
         WHERE order_id = $4`,
        [transaction.id, Array.from(coveredProductIds), paid, transaction.order_id]
      );
    }

    if (paid) {
      await client.query(
        `UPDATE orders
         SET payment_status = CASE
           WHEN EXISTS (
             SELECT 1
             FROM order_items
             WHERE order_id = $1
               AND payment_status <> 'paid'::payment_status
           ) THEN 'unpaid'::payment_status
           ELSE 'paid'::payment_status
         END
         WHERE id = $1`,
        [transaction.order_id]
      );
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
         SET refunded_amount = payment_totals.refunded_amount,
             payment_status = CASE
               WHEN payment_totals.prepaid_amount > payment_totals.refunded_amount
                 THEN 'paid'::payment_status
               WHEN payment_totals.refunded_amount > 0
                 THEN 'refunded'::payment_status
               ELSE 'unpaid'::payment_status
             END
         FROM (
           SELECT order_id,
                  COALESCE(SUM(prepaid_amount), 0) AS prepaid_amount,
                  COALESCE(SUM(refunded_amount), 0) AS refunded_amount
           FROM order_items
           WHERE order_id = $1
           GROUP BY order_id
         ) AS payment_totals
         WHERE orders.id = payment_totals.order_id`,
        [transaction.order_id]
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
