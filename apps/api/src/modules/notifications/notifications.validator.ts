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
  organizationId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  eventType: z
    .enum([
      'booking_created',
      'eta_warning',
      'called',
      'serving',
      'completed',
      'cancelled',
      'no_show',
      'deferred',
      'location_warning',
    ])
    .optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
}).superRefine((value, context) => {
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    context.addIssue({
      code: 'custom',
      path: ['createdTo'],
      message: 'createdTo must be on or after createdFrom',
    });
  }
});

export const NotificationOperationParamsSchema = z.object({ id: z.string().uuid() });
export const NotificationOperationBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
