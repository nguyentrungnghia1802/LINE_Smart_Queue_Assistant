import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const CreateOrderSchema = z.object({
  orgSlug: z.string().min(1),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  items: z.array(OrderItemSchema).min(1),
  bookingGroupId: z.string().uuid().optional(),
  localDeviceKey: z.string().min(1).max(160).optional(),
  customerLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().nonnegative().optional(),
    })
    .optional(),
  notes: z.string().max(500).optional(),
  payment: z
    .object({
      transactionId: z.string().uuid(),
    })
    .optional(),
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
