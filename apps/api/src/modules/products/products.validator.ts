import { z } from 'zod';

const RelativeMediaUrlSchema = z
  .string()
  .max(2_000)
  .regex(
    /^\/(?:media|mock-media)\/[a-zA-Z0-9][a-zA-Z0-9/_-]*(?:\.[a-zA-Z0-9]+)?$/,
    'Image URL must be an uploaded media path'
  );

const AbsoluteImageUrlSchema = z
  .string()
  .max(2_000)
  .url()
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Image URL must use HTTP or HTTPS');

const ProductImageUrlSchema = z.union([RelativeMediaUrlSchema, AbsoluteImageUrlSchema]);

const ProductFieldsSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    imageUrl: ProductImageUrlSchema.optional(),
    price: z.number().min(0).max(100_000_000),
    serviceTimeMinutes: z.number().int().min(1).max(480),
    maxWaitMinutes: z.number().int().min(1).max(1_440).optional(),
    requiresPrepayment: z.boolean().default(false),
    productType: z.enum(['product', 'service']).default('service'),
  })
  .strict();

function validateProductConfiguration(
  value: {
    price?: number;
    requiresPrepayment?: boolean;
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
}

export const CreateProductSchema = ProductFieldsSchema.superRefine(validateProductConfiguration);

export const UpdateProductSchema = ProductFieldsSchema.partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .superRefine(validateProductConfiguration);

export const UpdateBranchStockSchema = z.object({
  stockQuantity: z.number().int().min(0).max(100_000_000).nullable(),
  lowStockThreshold: z.number().int().min(0).max(100000).default(10),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type UpdateBranchStockDto = z.infer<typeof UpdateBranchStockSchema>;
