import { z } from 'zod';

import { JapanesePhoneSchema } from '../shared/shared.validator';

export const AdminOrgIdParamSchema = z.object({
  orgId: z.string().uuid(),
});

export const AdminOrgManagerParamSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
});

const LogoUrlSchema = z
  .string()
  .max(850_000)
  .refine(
    (value) => {
      if (/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value)) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Logo must be an image URL or a compressed data URL' }
  );

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(160),
  defaultLocale: z.enum(['ja', 'vi', 'en']).default('ja'),
  slug: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  logoUrl: LogoUrlSchema.nullable().optional(),
  phone: JapanesePhoneSchema.nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  postalCode: z
    .string()
    .regex(/^[0-9]{3}-?[0-9]{4}$/)
    .nullable()
    .optional(),
  prefecture: z.string().max(20).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
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
  email: z
    .string()
    .email()
    .refine((value) => value.toLowerCase().endsWith('@gmail.com'), {
      message: 'Manager email must be a Gmail address',
    }),
  password: z.string().min(6).max(128),
});

export const CreateOrganizationRegistrationSchema = z.object({
  organization: CreateOrganizationSchema,
  manager: CreateManagerSchema,
});

export const UpdateManagerSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z
      .string()
      .email()
      .refine((value) => value.toLowerCase().endsWith('@gmail.com'), {
        message: 'Manager email must be a Gmail address',
      })
      .optional(),
    password: z.string().min(6).max(128).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type CreateManagerDto = z.infer<typeof CreateManagerSchema>;
export type CreateOrganizationDto = z.infer<typeof CreateOrganizationSchema>;
export type CreateOrganizationRegistrationDto = z.infer<
  typeof CreateOrganizationRegistrationSchema
>;
export type UpdateManagerDto = z.infer<typeof UpdateManagerSchema>;
export type UpdateOrganizationDto = z.infer<typeof UpdateOrganizationSchema>;
