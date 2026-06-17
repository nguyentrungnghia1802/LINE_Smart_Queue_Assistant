import { z } from 'zod';

export const UpdateOrgSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  paymentInfo: z.string().max(2000).nullable().optional(),
});

export type UpdateOrgSettingsDto = z.infer<typeof UpdateOrgSettingsSchema>;
