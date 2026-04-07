import { z } from 'zod';

// ── Create queue ───────────────────────────────────────────────────────────────

export const CreateQueueSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  prefix: z.string().max(10).optional(),
  maxCapacity: z.number().int().positive().optional(),
  avgServiceMs: z.number().int().positive().optional(),
});

// ── Update queue ───────────────────────────────────────────────────────────────

export const UpdateQueueSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['open', 'paused', 'closed']).optional(),
    maxCapacity: z.number().int().positive().optional(),
    avgServiceMs: z.number().int().positive().optional(),
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
