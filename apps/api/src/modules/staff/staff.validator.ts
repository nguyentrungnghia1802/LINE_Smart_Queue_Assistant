import { z } from 'zod';

import { UUIDSchema } from '../shared/shared.validator';

export const QueueIdParamSchema = z.object({
  queueId: UUIDSchema,
});

export const EntryIdParamSchema = z.object({
  entryId: UUIDSchema,
});

export const MyQueueQuerySchema = z.object({
  queueId: UUIDSchema.optional(),
});

export type QueueIdParam = z.infer<typeof QueueIdParamSchema>;
export type EntryIdParam = z.infer<typeof EntryIdParamSchema>;
export type MyQueueQuery = z.infer<typeof MyQueueQuerySchema>;
