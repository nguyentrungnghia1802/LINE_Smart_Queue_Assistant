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
    '日本の電話番号を入力してください'
  );

export type PaginationQuery = z.infer<typeof PaginationSchema>;
export type UUIDParam = z.infer<typeof UUIDParamSchema>;
