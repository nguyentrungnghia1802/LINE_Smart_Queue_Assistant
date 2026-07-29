import { z } from 'zod';

import { JapanesePhoneSchema } from '../shared/shared.validator';

const ManagerInvitationSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: JapanesePhoneSchema,
  jobTitle: z.string().trim().max(120).nullable().optional(),
});

const CoordinatesSchema = z
  .object({
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine(
    (value) =>
      (value.latitude === null || value.latitude === undefined) ===
      (value.longitude === null || value.longitude === undefined),
    {
      message: 'Latitude and longitude must be provided together',
      path: ['latitude'],
    }
  );

export const CreateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    phone: JapanesePhoneSchema,
    email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^[0-9]{3}-?[0-9]{4}$/),
    prefecture: z.string().trim().min(1).max(20),
    city: z.string().trim().min(1).max(100),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    googlePlaceId: z.string().trim().max(255).nullable().optional(),
    formattedMapAddress: z.string().trim().max(500).nullable().optional(),
    managers: z.array(ManagerInvitationSchema).min(1).max(10),
  })
  .and(CoordinatesSchema);

export const InviteBranchManagerSchema = ManagerInvitationSchema;

export const UpdateMyBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    phone: JapanesePhoneSchema.optional(),
    email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^[0-9]{3}-?[0-9]{4}$/)
      .optional(),
    prefecture: z.string().trim().min(1).max(20).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    addressLine1: z.string().trim().min(1).max(200).optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    googlePlaceId: z.string().trim().max(255).nullable().optional(),
    formattedMapAddress: z.string().trim().max(500).nullable().optional(),
    paymentSettings: z
      .object({
        merchantName: z.string().trim().max(160).optional(),
        collectionProvider: z.enum(['payos', 'future_japan', 'manual']).optional(),
        currencyCode: z.enum(['JPY', 'VND']).optional(),
        settlementMethod: z.enum(['bank_transfer', 'card', 'paypay', 'cash']).optional(),
        bankName: z.string().trim().max(120).optional(),
        bankBranchName: z.string().trim().max(120).optional(),
        accountType: z.enum(['ordinary', 'checking']).optional(),
        accountHolder: z.string().trim().max(160).optional(),
        accountNumberLast4: z
          .string()
          .trim()
          .regex(/^[0-9]{4}$/)
          .optional(),
        invoiceRegistrationNumber: z
          .string()
          .trim()
          .regex(/^T[0-9]{13}$/)
          .optional(),
      })
      .optional(),
  })
  .and(CoordinatesSchema)
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

export const BranchIdParamSchema = z.object({
  branchId: z.string().uuid(),
});

export const BranchManagerParamSchema = z.object({
  branchId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const AuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const BranchGeocodeSchema = z.object({
  query: z.string().trim().min(3).max(500),
});

export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;
export type InviteBranchManagerDto = z.infer<typeof InviteBranchManagerSchema>;
export type UpdateMyBranchDto = z.infer<typeof UpdateMyBranchSchema>;
export type BranchGeocodeDto = z.infer<typeof BranchGeocodeSchema>;
