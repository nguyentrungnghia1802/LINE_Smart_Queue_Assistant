import { z } from 'zod';

export const UpdateOrgSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  paymentInfo: z.string().max(2000).nullable().optional(),
  settings: z
    .object({
      businessHours: z
        .object({
          open: z.string().max(10).optional(),
          close: z.string().max(10).optional(),
          holidays: z.string().max(500).optional(),
        })
        .optional(),
      paymentProvider: z
        .object({
          provider: z.string().max(80).optional(),
          merchantId: z.string().max(120).optional(),
          demoMode: z.boolean().optional(),
        })
        .optional(),
      notificationPreferences: z
        .object({
          lineEnabled: z.boolean().optional(),
          retryEnabled: z.boolean().optional(),
          notifyBeforeTurns: z.number().int().min(1).max(20).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type UpdateOrgSettingsDto = z.infer<typeof UpdateOrgSettingsSchema>;
