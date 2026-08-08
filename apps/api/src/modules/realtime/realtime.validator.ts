import { z } from 'zod';

export const RealtimeTicketParamsSchema = z.object({
  entryId: z.string().uuid(),
});

export const RealtimeQueueParamsSchema = z.object({
  queueId: z.string().uuid(),
});

export type RealtimeTicketParams = z.infer<typeof RealtimeTicketParamsSchema>;
export type RealtimeQueueParams = z.infer<typeof RealtimeQueueParamsSchema>;
