import { z } from 'zod';

const PaymentItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const CreatePaymentIntentSchema = z.object({
  orgSlug: z.string().min(1).max(120),
  items: z.array(PaymentItemSchema).min(1),
  scope: z.enum(['required_items', 'all_items']),
  provider: z.enum(['demo', 'stripe', 'komoju', 'paypay']).default('demo'),
  method: z.string().min(1).max(60).default('demo'),
  currency: z.string().length(3).default('JPY'),
  returnUrl: z.string().url().max(2000).optional(),
  cartSignature: z.string().max(1000).optional(),
});

export const CompleteDemoPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  demoToken: z.string().min(32).max(256),
});

export const PaymentTransactionParamSchema = z.object({
  transactionId: z.string().uuid(),
});

export const PaymentProviderParamSchema = z.object({
  provider: z.enum(['demo', 'stripe', 'komoju', 'paypay']),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;
export type CompleteDemoPaymentDto = z.infer<typeof CompleteDemoPaymentSchema>;
