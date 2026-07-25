import { z } from 'zod';

const RelativeMediaUrlSchema = z
  .string()
  .regex(
    /^\/(?:media|mock-media)\/[a-zA-Z0-9][a-zA-Z0-9/_-]*(?:\.[a-zA-Z0-9]+)?$/,
    'Image URL must be an uploaded media path'
  );

const AbsoluteImageUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Image URL must use HTTP or HTTPS');

const ProductImageUrlSchema = z.union([RelativeMediaUrlSchema, AbsoluteImageUrlSchema]);

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: ProductImageUrlSchema.optional(),
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
