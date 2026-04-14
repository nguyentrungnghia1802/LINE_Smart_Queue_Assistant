import { z } from 'zod';

import { UUIDSchema } from '../shared/shared.validator';

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

export const JoinQueueSchema = z.object({
  queueId: UUIDSchema,
  lineUserId: z.string().min(1).max(60).optional(),
  notes: z.string().max(500).optional(),
});

// ── GET /api/v1/queue/current?queueId=<uuid> ─────────────────────────────────

export const CurrentQueueQuerySchema = z.object({
  queueId: UUIDSchema,
});

// ── POST /api/v1/queue/:entryId/cancel|skip ───────────────────────────────────

export const EntryIdParamSchema = z.object({
  entryId: UUIDSchema,
});

// ── GET /api/v1/queue/:queueId/status ────────────────────────────────────────

export const QueueIdParamSchema = z.object({
  queueId: UUIDSchema,
});

// ── Inferred DTO types ────────────────────────────────────────────────────────

export type JoinQueueDto = z.infer<typeof JoinQueueSchema>;
export type CurrentQueueQuery = z.infer<typeof CurrentQueueQuerySchema>;
export type EntryIdParam = z.infer<typeof EntryIdParamSchema>;
export type QueueIdParam = z.infer<typeof QueueIdParamSchema>;
