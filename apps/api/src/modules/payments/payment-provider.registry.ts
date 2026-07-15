import { config } from '../../config';

import { ExternalPaymentProvider, PaymentProviderId } from './payments.types';
import { demoPaymentProvider } from './providers/demo-payment.provider';
import { UnsupportedExternalPaymentProvider } from './providers/unsupported-external.provider';

const externalProviders: Record<Exclude<PaymentProviderId, 'demo'>, ExternalPaymentProvider> = {
  stripe: new UnsupportedExternalPaymentProvider('stripe'),
  komoju: new UnsupportedExternalPaymentProvider('komoju'),
  paypay: new UnsupportedExternalPaymentProvider('paypay'),
};

export function getPaymentProvider(provider: PaymentProviderId): ExternalPaymentProvider {
  if (provider === 'demo') return demoPaymentProvider;
  if (config.payments.mode !== 'external') return demoPaymentProvider;
  return externalProviders[provider];
}
