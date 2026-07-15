import type { CheckoutSession } from './checkoutSession';

export type PaymentGatewayMode = 'demo' | 'external';

export interface PaymentGatewayMethod {
  id: string;
  label: string;
  description: string;
  provider: 'demo' | 'stripe' | 'komoju' | 'paypay' | 'rakuten_pay' | 'line_pay' | 'konbini';
  externalMethod?: string;
}

export interface PaymentRequest {
  session: CheckoutSession;
  method: PaymentGatewayMethod;
  amount: number;
  scope: 'required_items' | 'all_items';
  returnUrl: string;
}

export interface PaymentIntent {
  mode: PaymentGatewayMode;
  provider: PaymentGatewayMethod['provider'];
  transactionId: string;
  redirectUrl?: string;
  demoFallback: boolean;
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
    provider: 'rakuten_pay',
    externalMethod: 'rakuten_pay',
  },
  {
    id: 'line_pay',
    label: 'LINE Pay',
    description: 'LINE連携決済の接続枠',
    provider: 'line_pay',
    externalMethod: 'line_pay',
  },
  {
    id: 'konbini',
    label: 'コンビニ払い',
    description: 'KOMOJU等の番号発行に対応予定',
    provider: 'konbini',
    externalMethod: 'konbini',
  },
];

export function createPaymentIntent(request: PaymentRequest): PaymentIntent {
  const transactionId = `${request.method.provider.toUpperCase()}-${Date.now()
    .toString(36)
    .toUpperCase()}`;

  if (ENABLE_EXTERNAL_PAYMENT && EXTERNAL_REDIRECT_BASE_URL) {
    const redirectUrl = new URL(EXTERNAL_REDIRECT_BASE_URL);
    redirectUrl.searchParams.set('session_id', request.session.id);
    redirectUrl.searchParams.set('amount', String(request.amount));
    redirectUrl.searchParams.set('currency', 'JPY');
    redirectUrl.searchParams.set('method', request.method.externalMethod ?? request.method.id);
    redirectUrl.searchParams.set('return_url', request.returnUrl);

    return {
      mode: 'external',
      provider: request.method.provider,
      transactionId,
      redirectUrl: redirectUrl.toString(),
      demoFallback: false,
    };
  }

  return {
    mode: 'demo',
    provider: 'demo',
    transactionId: `DEMO-${Date.now().toString(36).toUpperCase()}`,
    demoFallback: true,
  };
}

export function isExternalPaymentConfigured() {
  return ENABLE_EXTERNAL_PAYMENT && Boolean(EXTERNAL_REDIRECT_BASE_URL);
}
