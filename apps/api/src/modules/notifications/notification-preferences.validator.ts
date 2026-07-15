import { z } from 'zod';

export const UpdateNotificationPreferencesSchema = z.object({
  notificationEnabled: z.boolean(),
  approachingEnabled: z.boolean(),
  calledEnabled: z.boolean(),
  lifecycleEnabled: z.boolean(),
});

export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesSchema>;
