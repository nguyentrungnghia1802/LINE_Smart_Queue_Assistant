import { config } from '../../../config';
import { AppError } from '../../../utils/AppError';
import {
  ExternalPaymentProvider,
  ParsedWebhookEvent,
  PaymentProviderId,
  ProviderCreateIntentInput,
  ProviderCreateIntentResult,
  ProviderPaymentStatus,
} from '../payments.types';

export class UnsupportedExternalPaymentProvider implements ExternalPaymentProvider {
  constructor(readonly provider: Exclude<PaymentProviderId, 'demo'>) {}

  async createPaymentIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult> {
    if (!config.payments.externalRedirectBaseUrl) {
      throw AppError.serviceUnavailable(`${this.provider} payment is not configured`);
    }

    const checkout = new URL(config.payments.externalRedirectBaseUrl);
    checkout.searchParams.set('provider', this.provider);
    checkout.searchParams.set('transaction_id', input.transactionId);
    checkout.searchParams.set('amount', String(input.amount));
    checkout.searchParams.set('currency', input.currency);
    checkout.searchParams.set('method', input.method);
    if (input.returnUrl) checkout.searchParams.set('return_url', input.returnUrl);

    return {
      providerIntentId: `${this.provider}_pi_${input.transactionId.replaceAll('-', '')}`,
      checkoutUrl: checkout.toString(),
      status: 'pending',
      rawPayload: { provider: this.provider, externalStub: true },
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }

  parseWebhookPayload(): ParsedWebhookEvent {
    throw AppError.serviceUnavailable(`${this.provider} webhook parser is not implemented`);
  }

  async retrievePaymentStatus(): Promise<ProviderPaymentStatus> {
    return { status: 'pending', rawPayload: { provider: this.provider, externalStub: true } };
  }
}
