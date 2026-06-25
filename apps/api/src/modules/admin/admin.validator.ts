import { z } from 'zod';

export const AdminOrgIdParamSchema = z.object({
  orgId: z.string().uuid(),
});

export const AdminOrgManagerParamSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  publicQrToken: z.string().min(8).max(128).optional(),
  logoUrl: z.string().url().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  paymentInfo: z.string().max(1000).nullable().optional(),
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial().refine(
  (d) => Object.values(d).some((v) => v !== undefined),
  {
    message: 'At least one field must be provided',
  }
);

export const CreateManagerSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export const UpdateManagerSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(128).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type CreateManagerDto = z.infer<typeof CreateManagerSchema>;
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type UpdateManagerDto = z.infer<typeof UpdateManagerSchema>;
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
