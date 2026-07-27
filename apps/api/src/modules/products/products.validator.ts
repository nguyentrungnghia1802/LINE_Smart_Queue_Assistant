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

const ProductFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: ProductImageUrlSchema.optional(),
  price: z.number().min(0),
  serviceTimeMinutes: z.number().int().min(1).max(480),
  maxWaitMinutes: z.number().int().min(1).optional(),
  requiresPrepayment: z.boolean().default(false),
  stockQuantity: z.number().int().min(0).optional(),
  productType: z.enum(['product', 'service']).default('service'),
  queueIds: z.array(z.string().uuid()).min(1).max(50),
});

function validateProductConfiguration(
  value: {
    price?: number;
    requiresPrepayment?: boolean;
    stockQuantity?: number;
    productType?: 'product' | 'service';
  },
  ctx: z.RefinementCtx
) {
  if (value.requiresPrepayment === true && value.price !== undefined && value.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Prepaid products must have a price greater than zero',
    });
  }
  if (value.productType === 'service' && value.stockQuantity !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stockQuantity'],
      message: 'Services must use unlimited stock',
    });
  }
}

export const CreateProductSchema = ProductFieldsSchema.superRefine(validateProductConfiguration);

export const UpdateProductSchema = ProductFieldsSchema.partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .superRefine(validateProductConfiguration);

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
