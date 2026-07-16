import { z } from 'zod';

import { PaginationSchema } from '../shared/shared.validator';

// ── GET /api/v1/notifications ─────────────────────────────────────────────────

export const ListNotificationsQuerySchema = PaginationSchema.extend({
  /** Filter by delivery channel */
  channel: z.enum(['LINE', 'EMAIL', 'PUSH']).optional(),
  /** Filter by delivery status */
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']).optional(),
});

export const ListNotificationOperationsQuerySchema = PaginationSchema.extend({
  status: z.enum(['pending', 'processing', 'sent', 'failed', 'cancelled']).optional(),
});

export const NotificationOperationParamsSchema = z.object({ id: z.string().uuid() });
export const NotificationOperationBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
