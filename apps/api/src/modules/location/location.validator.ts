import { z } from 'zod';

export const UpdateLocationConsentSchema = z.object({ enabled: z.boolean() });

export const CustomerLocationSnapshotSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().int().min(0).max(100_000).optional(),
});

export type CustomerLocationSnapshotDto = z.infer<typeof CustomerLocationSnapshotSchema>;
