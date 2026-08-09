import { z } from 'zod';

import { NUMERIC_LIMITS } from '@line-queue/shared';

import { JapanesePhoneSchema } from '../shared/shared.validator';

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z
    .number()
    .int()
    .min(NUMERIC_LIMITS.orderItemQuantity.min)
    .max(NUMERIC_LIMITS.orderItemQuantity.max),
});

export const CreateOrderSchema = z
  .object({
    orgSlug: z.string().min(1).max(120),
    branchId: z.string().uuid(),
    queueId: z.string().uuid(),
    customerName: z.string().trim().min(1).max(100),
    customerPhone: JapanesePhoneSchema,
    items: z
      .array(OrderItemSchema)
      .min(NUMERIC_LIMITS.orderLineItems.min)
      .max(NUMERIC_LIMITS.orderLineItems.max),
    bookingGroupId: z.string().uuid().optional(),
    localDeviceKey: z.string().min(1).max(160).optional(),
    customerLocation: z
      .object({
        latitude: z.number().min(NUMERIC_LIMITS.latitude.min).max(NUMERIC_LIMITS.latitude.max),
        longitude: z.number().min(NUMERIC_LIMITS.longitude.min).max(NUMERIC_LIMITS.longitude.max),
        accuracyMeters: z
          .number()
          .min(NUMERIC_LIMITS.locationAccuracyMeters.min)
          .max(NUMERIC_LIMITS.locationAccuracyMeters.max)
          .optional(),
      })
      .optional(),
    notes: z.string().max(500).optional(),
    payment: z
      .object({
        transactionId: z.string().uuid(),
      })
      .optional(),
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

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['processing', 'completed', 'cancelled']),
});

export const UpdateOrderPaymentSchema = z.object({
  paymentStatus: z.enum(['paid', 'refunded']),
  amount: z.number().positive().optional(),
  reason: z.string().min(1).max(500).optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
export type UpdateOrderPaymentDto = z.infer<typeof UpdateOrderPaymentSchema>;
