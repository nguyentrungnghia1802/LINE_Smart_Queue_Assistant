import { z } from 'zod';

// ── Create queue ───────────────────────────────────────────────────────────────

export const CreateQueueSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  status: z.enum(['open', 'paused', 'closed']).default('open'),
  prefix: z.string().max(10).optional(),
  maxCapacity: z.number().int().positive().optional(),
  avgServiceTimeMinutes: z.number().int().positive().optional(),
  absenceGraceMinutes: z.number().int().min(1).max(120).default(5),
  productIds: z.array(z.string().uuid()).max(200).default([]),
});

// ── Update queue ───────────────────────────────────────────────────────────────

export const UpdateQueueSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['open', 'paused', 'closed']).optional(),
    maxCapacity: z.number().int().positive().optional(),
    avgServiceTimeMinutes: z.number().int().positive().optional(),
    absenceGraceMinutes: z.number().int().min(1).max(120).optional(),
    productIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

// ── Update queue status ────────────────────────────────────────────────────────

export const UpdateQueueStatusSchema = z.object({
  status: z.enum(['open', 'paused', 'closed']),
});

// ── Inferred types ─────────────────────────────────────────────────────────────

export type CreateQueueDto = z.infer<typeof CreateQueueSchema>;
export type UpdateQueueDto = z.infer<typeof UpdateQueueSchema>;
export type UpdateQueueStatusDto = z.infer<typeof UpdateQueueStatusSchema>;
