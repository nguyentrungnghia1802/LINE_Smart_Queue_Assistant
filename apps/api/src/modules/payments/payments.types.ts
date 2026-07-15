export type PaymentProviderId = 'demo' | 'stripe' | 'komoju' | 'paypay';

export type PaymentState = 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type PaymentScope = 'required_items' | 'all_items';

export interface PaymentIntentProduct {
  productId: string;
  quantity: number;
}

export interface PaymentIntentMetadata {
  orgSlug: string;
  scope: PaymentScope;
  coveredProductIds: string[];
  cartSignature?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    requiresPrepayment: boolean;
  }>;
}

export interface ProviderCreateIntentInput {
  transactionId: string;
  amount: number;
  currency: string;
  method: string;
  returnUrl?: string;
  metadata: PaymentIntentMetadata;
}

export interface ProviderCreateIntentResult {
  providerIntentId: string;
  checkoutUrl: string | null;
  status: PaymentState;
  rawPayload?: Record<string, unknown>;
  demoToken?: string;
}

export interface ProviderPaymentStatus {
  status: PaymentState;
  providerIntentId?: string;
  rawPayload?: Record<string, unknown>;
}

export interface ParsedWebhookEvent {
  eventId: string;
  eventType: string;
  transactionId: string;
  providerIntentId?: string;
  status: PaymentState;
  occurredAt?: Date;
  refundedAmount?: number;
  rawPayload: Record<string, unknown>;
}

export interface ExternalPaymentProvider {
  readonly provider: PaymentProviderId;
  createPaymentIntent(input: ProviderCreateIntentInput): Promise<ProviderCreateIntentResult>;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, unknown>): boolean;
  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent;
  retrievePaymentStatus(transactionId: string): Promise<ProviderPaymentStatus>;
  verifyReturnToken?(transactionId: string, token: string): boolean;
}
