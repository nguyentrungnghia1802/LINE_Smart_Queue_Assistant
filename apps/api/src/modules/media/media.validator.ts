import { z } from 'zod';

export const UploadMediaSchema = z.object({
  dataUrl: z.string().max(8_000_000),
  purpose: z.enum(['organization_logo', 'product_image']),
  organizationId: z.string().uuid().nullable().optional(),
});

export const MediaParamsSchema = z.object({ id: z.string().uuid() });
