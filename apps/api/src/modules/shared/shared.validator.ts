import { z } from 'zod';

// ── Shared primitives ──────────────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid('Must be a valid UUID');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UUIDParamSchema = z.object({
  id: UUIDSchema,
});

export const JapanesePhoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine(
    (value) => /^(?:\+81|0)\d{9,10}$/.test(value.replace(/[\s()-]/g, '')),
    'Enter a valid Japanese phone number'
  );

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

export const StoredImageUrlSchema = z.union([RelativeMediaUrlSchema, AbsoluteImageUrlSchema]);

export const BusinessPasswordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export type PaginationQuery = z.infer<typeof PaginationSchema>;
export type UUIDParam = z.infer<typeof UUIDParamSchema>;
