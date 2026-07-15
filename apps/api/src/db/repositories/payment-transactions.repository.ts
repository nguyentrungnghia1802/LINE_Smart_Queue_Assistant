import { PoolClient } from 'pg';

import { PaymentState } from '../../modules/payments/payments.types';
import { pool } from '../client';

import { PaymentTransactionRow } from './orders.repository';

interface CreatePaymentTransactionInput {
  organizationId: string;
  provider: string;
  method: string;
  status: PaymentState;
  amount: number;
  currency: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
}

interface UpdateProviderIntentInput {
  paymentIntentId: string;
  externalTransactionId?: string | null;
  checkoutUrl?: string | null;
  status: PaymentState;
  rawPayload?: Record<string, unknown>;
}

interface WebhookEventInput {
  provider: string;
  eventId: string;
  eventType: string;
  paymentTransactionId?: string | null;
  signatureValid: boolean;
  rawPayload?: Record<string, unknown>;
}

export interface PaymentWebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payment_transaction_id: string | null;
  signature_valid: boolean;
  processing_status: string;
  raw_payload: Record<string, unknown>;
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
}

export const paymentTransactionsRepository = {
  async createIntent(
    data: CreatePaymentTransactionInput,
    client?: PoolClient
  ): Promise<PaymentTransactionRow> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentTransactionRow>(
      `INSERT INTO payment_transactions
         (
           organization_id, provider, method, status, amount, currency,
           return_url, metadata, raw_payload
         )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        data.organizationId,
        data.provider,
        data.method,
        data.status,
        data.amount,
        data.currency,
        data.returnUrl ?? null,
        JSON.stringify(data.metadata ?? {}),
        JSON.stringify(data.rawPayload ?? {}),
      ]
    );
    return rows[0];
  },

  async updateProviderIntent(
    id: string,
    data: UpdateProviderIntentInput,
    client?: PoolClient
  ): Promise<PaymentTransactionRow | null> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentTransactionRow>(
      `UPDATE payment_transactions
       SET payment_intent_id = $2,
           external_transaction_id = $3,
           checkout_url = $4,
           redirect_url = $4,
           status = $5,
           raw_payload = raw_payload || $6::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.paymentIntentId,
        data.externalTransactionId ?? data.paymentIntentId,
        data.checkoutUrl ?? null,
        data.status,
        JSON.stringify(data.rawPayload ?? {}),
      ]
    );
    return rows[0] ?? null;
  },

  async findById(id: string, client?: PoolClient): Promise<PaymentTransactionRow | null> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentTransactionRow>(
      `SELECT * FROM payment_transactions WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async updateStatus(
    id: string,
    data: {
      status: PaymentState;
      providerIntentId?: string;
      rawPayload?: Record<string, unknown>;
      lastError?: string | null;
    },
    client?: PoolClient
  ): Promise<PaymentTransactionRow | null> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentTransactionRow>(
      `UPDATE payment_transactions
       SET status = $2,
           payment_intent_id = COALESCE($3, payment_intent_id),
           external_transaction_id = COALESCE($3, external_transaction_id),
           raw_payload = raw_payload || $4::jsonb,
           last_error = $5,
           last_verified_at = NOW(),
           authorized_at = CASE WHEN $2 = 'authorized' THEN COALESCE(authorized_at, NOW()) ELSE authorized_at END,
           paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
           failed_at = CASE WHEN $2 = 'failed' THEN COALESCE(failed_at, NOW()) ELSE failed_at END,
           cancelled_at = CASE WHEN $2 = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
           refunded_at = CASE WHEN $2 = 'refunded' THEN COALESCE(refunded_at, NOW()) ELSE refunded_at END
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.status,
        data.providerIntentId ?? null,
        JSON.stringify(data.rawPayload ?? {}),
        data.lastError ?? null,
      ]
    );
    return rows[0] ?? null;
  },

  async attachToOrder(id: string, orderId: string, client?: PoolClient): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
      `UPDATE payment_transactions
       SET order_id = $2
       WHERE id = $1 AND (order_id IS NULL OR order_id = $2)`,
      [id, orderId]
    );
  },

  async insertWebhookEvent(
    data: WebhookEventInput,
    client?: PoolClient
  ): Promise<{ row: PaymentWebhookEventRow; inserted: boolean }> {
    const executor = client ?? pool;
    const { rows } = await executor.query<PaymentWebhookEventRow & { inserted: boolean }>(
      `INSERT INTO payment_webhook_events
         (
           provider, event_id, event_type, payment_transaction_id,
           signature_valid, raw_payload, processing_status
         )
       VALUES ($1,$2,$3,$4,$5,$6,'received')
       ON CONFLICT (provider, event_id) DO UPDATE
       SET processing_status = payment_webhook_events.processing_status
       RETURNING *, (xmax = 0) AS inserted`,
      [
        data.provider,
        data.eventId,
        data.eventType,
        data.paymentTransactionId ?? null,
        data.signatureValid,
        JSON.stringify(data.rawPayload ?? {}),
      ]
    );
    return { row: rows[0], inserted: rows[0]?.inserted === true };
  },

  async markWebhookProcessed(
    provider: string,
    eventId: string,
    status: 'processed' | 'failed',
    errorMessage?: string,
    client?: PoolClient
  ): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
      `UPDATE payment_webhook_events
       SET processing_status = $3,
           error_message = $4,
           processed_at = NOW()
       WHERE provider = $1 AND event_id = $2`,
      [provider, eventId, status, errorMessage ?? null]
    );
  },
};
