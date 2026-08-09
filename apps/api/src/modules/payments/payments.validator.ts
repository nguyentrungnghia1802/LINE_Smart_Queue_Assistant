import { z } from 'zod';

import { NUMERIC_LIMITS } from '@line-queue/shared';

const PaymentItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z
    .number()
    .int()
    .min(NUMERIC_LIMITS.orderItemQuantity.min)
    .max(NUMERIC_LIMITS.orderItemQuantity.max),
});

export const CreatePaymentIntentSchema = z
  .object({
    orgSlug: z.string().min(1).max(120),
    branchId: z.string().uuid(),
    queueId: z.string().uuid(),
    items: z
      .array(PaymentItemSchema)
      .min(NUMERIC_LIMITS.orderLineItems.min)
      .max(NUMERIC_LIMITS.orderLineItems.max),
    scope: z.enum(['required_items', 'all_items']),
    provider: z.enum(['demo', 'payos', 'stripe', 'komoju', 'paypay']).default('demo'),
    method: z.string().min(1).max(60).default('demo'),
    currency: z.string().length(3).default('JPY'),
    returnUrl: z.string().url().max(2000).optional(),
    cartSignature: z.string().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    const productIds = new Set<string>();
    value.items.forEach((item, index) => {
      if (productIds.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'productId'],
          message: 'Duplicate products are not allowed',
        });
      }
      productIds.add(item.productId);
    });
  });

export const CompleteDemoPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  demoToken: z.string().min(32).max(256),
});

export const PaymentTransactionParamSchema = z.object({
  transactionId: z.string().uuid(),
});

export const PaymentProviderParamSchema = z.object({
  provider: z.enum(['demo', 'payos', 'stripe', 'komoju', 'paypay']),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;
export type CompleteDemoPaymentDto = z.infer<typeof CompleteDemoPaymentSchema>;
