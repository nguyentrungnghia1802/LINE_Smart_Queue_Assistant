import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../../../config';
import { AppError } from '../../../utils/AppError';
import {
  ExternalPaymentProvider,
  ParsedWebhookEvent,
  ProviderCreateIntentInput,
  ProviderCreateIntentResult,
  ProviderPaymentStatus,
} from '../payments.types';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(value: string): string {
  return createHmac('sha256', config.payments.demoWebhookSecret).update(value).digest('hex');
}

function signatureAmount(value: string | number): string {
  return Number(value).toFixed(2);
}

export class DemoPaymentProvider implements ExternalPaymentProvider {
  readonly provider = 'demo' as const;

  async createPaymentIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult> {
    const providerIntentId = `demo_pi_${input.transactionId.replaceAll('-', '')}`;
    const demoToken = sign(
      `${input.transactionId}.${signatureAmount(input.amount)}.${input.currency}`
    );

    return {
      providerIntentId,
      checkoutUrl: null,
      status: 'pending',
      demoToken,
      rawPayload: {
        provider: this.provider,
        providerIntentId,
        demoMode: true,
        method: input.method,
      },
    };
  }

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, unknown>): boolean {
    const provided = String(headers['x-demo-payment-signature'] ?? '');
    if (!provided) return false;
    const expected = createHmac('sha256', config.payments.demoWebhookSecret)
      .update(rawBody)
      .digest('hex');
    return safeEqual(provided, expected);
  }

  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent {
    let payload: {
      eventId?: string;
      eventType?: string;
      transactionId?: string;
      providerIntentId?: string;
      status?: string;
    };

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw AppError.badRequest('Invalid payment webhook payload');
    }

    if (!payload.eventId || !payload.transactionId || !payload.status) {
      throw AppError.badRequest('Payment webhook payload is missing required fields');
    }

    if (
      !['pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded'].includes(payload.status)
    ) {
      throw AppError.badRequest('Unsupported payment webhook status');
    }

    return {
      eventId: payload.eventId,
      eventType: payload.eventType ?? `demo.payment.${payload.status}`,
      transactionId: payload.transactionId,
      providerIntentId: payload.providerIntentId,
      status: payload.status as ParsedWebhookEvent['status'],
      rawPayload: {
        eventId: payload.eventId,
        eventType: payload.eventType ?? `demo.payment.${payload.status}`,
        transactionId: payload.transactionId,
        providerIntentId: payload.providerIntentId,
        status: payload.status,
      },
    };
  }

  async retrievePaymentStatus(): Promise<ProviderPaymentStatus> {
    return { status: 'pending', rawPayload: { provider: this.provider, demoMode: true } };
  }

  verifyDemoCompletionToken(
    transactionId: string,
    amount: string | number,
    currency: string,
    token: string
  ) {
    return safeEqual(token, sign(`${transactionId}.${signatureAmount(amount)}.${currency}`));
  }
}

export const demoPaymentProvider = new DemoPaymentProvider();
