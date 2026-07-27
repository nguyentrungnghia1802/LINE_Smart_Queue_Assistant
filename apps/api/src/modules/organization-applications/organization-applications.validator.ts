import { z } from 'zod';

import { getSubscriptionPlanBranchLimit } from '@line-queue/shared';

import { JapanesePhoneSchema } from '../shared/shared.validator';

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

export const CreateOrganizationApplicationSchema = z
  .object({
    legalName: z.string().trim().min(2).max(200),
    tradeName: z.string().trim().min(2).max(160),
    businessType: z.enum(['restaurant', 'salon', 'clinic', 'retail', 'public_service', 'other']),
    registrationNumber: z.string().trim().max(32).nullable().optional(),
    websiteUrl: z.string().trim().url().max(500).nullable().optional(),
    contactName: z.string().trim().min(2).max(120),
    contactTitle: z.string().trim().max(120).nullable().optional(),
    workEmail: z.string().trim().toLowerCase().email().max(254),
    phone: JapanesePhoneSchema,
    postalCode: z
      .string()
      .trim()
      .regex(/^[0-9]{3}-?[0-9]{4}$/),
    prefecture: z.string().trim().min(1).max(20),
    city: z.string().trim().min(1).max(100),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    locationCount: z.coerce.number().int().min(1).max(10_000),
    expectedMonthlyCustomers: z.coerce.number().int().min(1).max(10_000_000),
    planCode: z.enum(['starter', 'standard', 'scale']),
    billingCycle: z.enum(['monthly', 'annual']),
    defaultLocale: z.enum(['ja', 'vi', 'en']).default('ja'),
    logoUrl: LogoUrlSchema.nullable().optional(),
    termsAccepted: z.literal(true),
  })
  .superRefine((application, context) => {
    const maxBranches = getSubscriptionPlanBranchLimit(application.planCode);
    if (maxBranches !== null && application.locationCount > maxBranches) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locationCount'],
        message: `The selected plan supports at most ${maxBranches} branches`,
      });
    }
  });

export const OrganizationApplicationIdParamSchema = z.object({
  applicationId: z.string().uuid(),
});

export const OrganizationApplicationListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
});

export const ReviewOrganizationApplicationSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
});

export type CreateOrganizationApplicationDto = z.infer<typeof CreateOrganizationApplicationSchema>;
export type OrganizationApplicationStatusFilter = z.infer<
  typeof OrganizationApplicationListQuerySchema
>['status'];
export type ReviewOrganizationApplicationDto = z.infer<typeof ReviewOrganizationApplicationSchema>;
