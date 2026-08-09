import { z } from 'zod';

import { NUMERIC_LIMITS } from '@line-queue/shared';

import { StoredImageUrlSchema } from '../shared/shared.validator';

const ProductFieldsSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    imageUrl: StoredImageUrlSchema.optional(),
    price: z.number().min(NUMERIC_LIMITS.productPrice.min).max(NUMERIC_LIMITS.productPrice.max),
    serviceTimeMinutes: z
      .number()
      .int()
      .min(NUMERIC_LIMITS.queueServiceMinutes.min)
      .max(NUMERIC_LIMITS.queueServiceMinutes.max),
    maxWaitMinutes: z
      .number()
      .int()
      .min(NUMERIC_LIMITS.productWaitMinutes.min)
      .max(NUMERIC_LIMITS.productWaitMinutes.max)
      .optional(),
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
    requiresPrepayment: z.boolean().optional(),
    productType: z.enum(['product', 'service']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  })
  .superRefine(validateProductConfiguration);

export const UpdateBranchStockSchema = z.object({
  stockQuantity: z
    .number()
    .int()
    .min(NUMERIC_LIMITS.stockQuantity.min)
    .max(NUMERIC_LIMITS.stockQuantity.max)
    .nullable(),
  lowStockThreshold: z
    .number()
    .int()
    .min(NUMERIC_LIMITS.lowStockThreshold.min)
    .max(NUMERIC_LIMITS.lowStockThreshold.max)
    .default(10),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type UpdateBranchStockDto = z.infer<typeof UpdateBranchStockSchema>;
