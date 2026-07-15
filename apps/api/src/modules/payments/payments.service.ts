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
      rawPayload: Record<string, unknown>;
    },
    signatureValid = true
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const transaction = await paymentTransactionsRepository.findById(event.transactionId, client);
      if (!transaction) throw AppError.notFound('Payment transaction');

      const { inserted } = await paymentTransactionsRepository.insertWebhookEvent(
        {
          provider: providerId,
          eventId: event.eventId,
          eventType: event.eventType,
          paymentTransactionId: transaction.id,
          signatureValid,
          rawPayload: event.rawPayload,
        },
        client
      );

      if (!inserted) {
        await client.query('COMMIT');
        return { duplicate: true, transaction: this.toPublicTransaction(transaction) };
      }

      const updated = await paymentTransactionsRepository.updateStatus(
        transaction.id,
        {
          status: event.status,
          providerIntentId: event.providerIntentId,
          rawPayload: event.rawPayload,
        },
        client
      );

      if (updated?.order_id) {
        await this.reconcileTransactionInClient(updated, client);
      }

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

  async reconcileTransactionInClient(
    transaction: PaymentTransactionRow,
    client: import('pg').PoolClient
  ) {
    if (!transaction.order_id) return;
    const metadata = metadataFromTransaction(transaction);
    const coveredProductIds = new Set(metadata.coveredProductIds ?? []);
    const paid = transaction.status === 'paid';

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
      updatedAt: transaction.updated_at,
    };
  },
};
