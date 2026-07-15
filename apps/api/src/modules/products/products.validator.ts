import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  price: z.number().min(0),
  serviceTimeMinutes: z.number().int().min(1).max(480),
  maxWaitMinutes: z.number().int().min(1).optional(),
  requiresPrepayment: z.boolean().default(false),
  stockQuantity: z.number().int().min(0).optional(),
  productType: z.enum(['product', 'service']).default('service'),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
