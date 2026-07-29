import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../../../config';
import { AppError } from '../../../utils/AppError';
import type {
  ExternalPaymentProvider,
  ParsedWebhookEvent,
  ProviderCreateIntentInput,
  ProviderCreateIntentResult,
  ProviderPaymentStatus,
} from '../payments.types';

interface PayosPaymentData {
  paymentLinkId?: string;
  status?: string;
  code?: string;
  amount?: number;
  reference?: string;
  transactionDateTime?: string;
}

function requireConfiguration() {
  if (
    !config.payments.payos.clientId ||
    !config.payments.payos.apiKey ||
    !config.payments.payos.checksumKey
  ) {
    throw new AppError(
      'payOS credentials are not configured',
      503,
      'PAYMENT_PROVIDER_NOT_CONFIGURED'
    );
  }
}

function sign(value: string): string {
  return createHmac('sha256', config.payments.payos.checksumKey).update(value).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function webhookSignatureData(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const value = data[key];
      const serialized =
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return `${key}=${serialized}`;
    })
    .join('&');
}

function providerStatus(value?: string): ProviderPaymentStatus['status'] {
  switch (value?.toUpperCase()) {
    case 'PAID':
      return 'paid';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'failed';
    default:
      return 'pending';
  }
}

function orderCodeFromTransaction(transactionId: string): number {
  const source = BigInt(`0x${transactionId.replace(/-/g, '')}`);
  return Number((source % 9_000_000_000_000_000n) + 1n);
}

export class PayosPaymentProvider implements ExternalPaymentProvider {
  readonly provider = 'payos' as const;

  async createPaymentIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult> {
    requireConfiguration();
    if (input.currency !== 'VND') {
      throw new AppError('payOS only supports VND payments', 422, 'PAYMENT_CURRENCY_UNSUPPORTED');
    }
    const returnUrl =
      input.returnUrl ||
      (config.payments.externalRedirectBaseUrl
        ? `${config.payments.externalRedirectBaseUrl.replace(/\/$/, '')}/payment-return`
        : '');
    if (!returnUrl) {
      throw new AppError(
        'A public payment return URL is required',
        503,
        'PAYMENT_RETURN_URL_NOT_CONFIGURED'
      );
    }

    const orderCode = orderCodeFromTransaction(input.transactionId);
    const amount = Math.round(input.amount);
    const description = `SQA ${input.transactionId.replace(/-/g, '').slice(0, 12)}`;
    const signatureData = `amount=${amount}&cancelUrl=${returnUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
    const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.payments.payos.clientId,
        'x-api-key': config.payments.payos.apiKey,
      },
      body: JSON.stringify({
        orderCode,
        amount,
        description,
        cancelUrl: returnUrl,
        returnUrl,
        signature: sign(signatureData),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json()) as {
      code?: string;
      desc?: string;
      data?: PayosPaymentData & { checkoutUrl?: string; qrCode?: string };
    };
    if (!response.ok || payload.code !== '00' || !payload.data?.paymentLinkId) {
      throw new AppError(
        `payOS intent creation failed: ${payload.desc ?? `HTTP ${response.status}`}`,
        502,
        'PAYMENT_PROVIDER_ERROR'
      );
    }
    return {
      providerIntentId: payload.data.paymentLinkId,
      checkoutUrl: payload.data.checkoutUrl ?? null,
      status: providerStatus(payload.data.status),
      rawPayload: {
        orderCode,
        qrCode: payload.data.qrCode,
        providerStatus: payload.data.status,
      },
    };
  }

  verifyWebhookSignature(rawBody: Buffer, _headers: Record<string, unknown>): boolean {
    requireConfiguration();
    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as {
        data?: Record<string, unknown>;
        signature?: string;
      };
      if (!payload.data || !payload.signature) return false;
      return safeEqual(payload.signature, sign(webhookSignatureData(payload.data)));
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent {
    let payload: {
      success?: boolean;
      data?: PayosPaymentData;
      signature?: string;
    };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      throw AppError.badRequest('Invalid payOS webhook payload');
    }
    const data = payload.data;
    if (!data?.paymentLinkId) throw AppError.badRequest('payOS webhook is missing paymentLinkId');
    const status = payload.success && data.code === '00' ? 'paid' : providerStatus(data.status);
    return {
      eventId: `${data.paymentLinkId}:${data.reference ?? data.code ?? status}`,
      eventType: `payos.payment.${status}`,
      providerIntentId: data.paymentLinkId,
      status,
      occurredAt: data.transactionDateTime ? new Date(data.transactionDateTime) : undefined,
      rawPayload: {
        paymentLinkId: data.paymentLinkId,
        amount: data.amount,
        reference: data.reference,
        code: data.code,
        status,
      },
    };
  }

  async retrievePaymentStatus(providerIntentId: string): Promise<ProviderPaymentStatus> {
    requireConfiguration();
    const response = await fetch(
      `https://api-merchant.payos.vn/v2/payment-requests/${encodeURIComponent(providerIntentId)}`,
      {
        headers: {
          'x-client-id': config.payments.payos.clientId,
          'x-api-key': config.payments.payos.apiKey,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const payload = (await response.json()) as {
      code?: string;
      data?: PayosPaymentData;
      desc?: string;
    };
    if (!response.ok || payload.code !== '00') {
      throw new AppError(
        `payOS reconciliation failed: ${payload.desc ?? `HTTP ${response.status}`}`,
        502,
        'PAYMENT_PROVIDER_ERROR'
      );
    }
    return {
      status: providerStatus(payload.data?.status),
      providerIntentId: payload.data?.paymentLinkId ?? providerIntentId,
      rawPayload: { providerStatus: payload.data?.status },
    };
  }
}

export const payosPaymentProvider = new PayosPaymentProvider();
