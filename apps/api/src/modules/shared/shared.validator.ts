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

export type PaginationQuery = z.infer<typeof PaginationSchema>;
export type UUIDParam = z.infer<typeof UUIDParamSchema>;
