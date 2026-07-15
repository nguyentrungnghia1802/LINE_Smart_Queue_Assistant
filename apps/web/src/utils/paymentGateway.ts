export type PaymentGatewayMode = 'demo' | 'external';
export type PaymentProvider = 'demo' | 'stripe' | 'komoju' | 'paypay';

export interface PaymentGatewayMethod {
  id: string;
  label: string;
  description: string;
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
    label: 'クレジットカード',
    description: 'Stripe / KOMOJU 接続準備済み',
    provider: 'stripe',
    externalMethod: 'card',
  },
  {
    id: 'paypay',
    label: 'PayPay',
    description: 'PayPay決済リンク接続準備済み',
    provider: 'paypay',
    externalMethod: 'paypay',
  },
  {
    id: 'rakuten_pay',
    label: '楽天ペイ',
    description: '楽天ペイ接続準備済み',
    provider: 'komoju',
    externalMethod: 'rakuten_pay',
  },
  {
    id: 'line_pay',
    label: 'LINE Pay',
    description: 'LINE連携決済の接続枠',
    provider: 'komoju',
    externalMethod: 'line_pay',
  },
  {
    id: 'konbini',
    label: 'コンビニ払い',
    description: 'KOMOJU等の番号発行に対応予定',
    provider: 'komoju',
    externalMethod: 'konbini',
  },
];

export function isExternalPaymentConfigured() {
  return ENABLE_EXTERNAL_PAYMENT && Boolean(EXTERNAL_REDIRECT_BASE_URL);
}
