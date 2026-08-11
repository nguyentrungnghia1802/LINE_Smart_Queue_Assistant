import { config } from '../../config';
import { AppError } from '../../utils/AppError';

import { ExternalPaymentProvider, PaymentProviderId } from './payments.types';
import { demoPaymentProvider } from './providers/demo-payment.provider';
import { payosPaymentProvider } from './providers/payos-payment.provider';
import { UnsupportedExternalPaymentProvider } from './providers/unsupported-external.provider';

const externalProviders: Record<Exclude<PaymentProviderId, 'demo'>, ExternalPaymentProvider> = {
  payos: payosPaymentProvider,
  stripe: new UnsupportedExternalPaymentProvider('stripe'),
  komoju: new UnsupportedExternalPaymentProvider('komoju'),
  paypay: new UnsupportedExternalPaymentProvider('paypay'),
};

export function getPaymentProvider(provider: PaymentProviderId): ExternalPaymentProvider {
  if (config.payments.mode === 'demo') return demoPaymentProvider;
  if (provider === 'demo') {
    throw new AppError(
      'Demo payment is disabled when PAYMENT_MODE=external',
      409,
      'PAYMENT_PROVIDER_DISABLED'
    );
  }
  return externalProviders[provider];
}
