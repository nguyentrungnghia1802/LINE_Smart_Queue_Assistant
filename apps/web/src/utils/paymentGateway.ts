export type PaymentGatewayMode = 'demo' | 'external';
export type PaymentProvider = 'demo' | 'stripe' | 'komoju' | 'paypay';

export interface PaymentGatewayMethod {
  id: string;
  labelKey: string;
  descriptionKey: string;
  provider: PaymentProvider;
  externalMethod?: string;
}

const EXTERNAL_REDIRECT_BASE_URL = import.meta.env.VITE_PAYMENT_REDIRECT_BASE_URL as
  | string
  | undefined;
const ENABLE_EXTERNAL_PAYMENT =
  (import.meta.env.VITE_PAYMENT_MODE as string | undefined)?.toLowerCase() === 'external';

export const PAYMENT_METHODS: PaymentGatewayMethod[] = [
  {
    id: 'credit_card',
    labelKey: 'payment.methods.creditCard.label',
    descriptionKey: 'payment.methods.creditCard.description',
    provider: 'stripe',
    externalMethod: 'card',
  },
  {
    id: 'paypay',
    labelKey: 'payment.methods.paypay.label',
    descriptionKey: 'payment.methods.paypay.description',
    provider: 'paypay',
    externalMethod: 'paypay',
  },
  {
    id: 'rakuten_pay',
    labelKey: 'payment.methods.rakuten.label',
    descriptionKey: 'payment.methods.rakuten.description',
    provider: 'komoju',
    externalMethod: 'rakuten_pay',
  },
  {
    id: 'line_pay',
    labelKey: 'payment.methods.linePay.label',
    descriptionKey: 'payment.methods.linePay.description',
    provider: 'komoju',
    externalMethod: 'line_pay',
  },
  {
    id: 'konbini',
    labelKey: 'payment.methods.konbini.label',
    descriptionKey: 'payment.methods.konbini.description',
    provider: 'komoju',
    externalMethod: 'konbini',
  },
];

export function isExternalPaymentConfigured() {
  return ENABLE_EXTERNAL_PAYMENT && Boolean(EXTERNAL_REDIRECT_BASE_URL);
}
