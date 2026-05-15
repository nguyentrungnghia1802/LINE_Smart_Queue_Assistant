import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const CreateOrderSchema = z.object({
  orgSlug: z.string().min(1),
  customerName: z.string().min(1).max(100).optional(),
  items: z.array(OrderItemSchema).min(1),
  notes: z.string().max(500).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['processing', 'completed', 'cancelled']),
});

export const UpdateOrderPaymentSchema = z.object({
  paymentStatus: z.enum(['unpaid', 'paid']),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusSchema>;
export type UpdateOrderPaymentDto = z.infer<typeof UpdateOrderPaymentSchema>;
