import { z } from 'zod';

import { BusinessPasswordSchema, JapanesePhoneSchema } from '../shared/shared.validator';

const LocaleSchema = z.enum(['ja', 'vi', 'en']);

export const CreateUserSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'staff', 'customer']).default('customer'),
});

export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    preferredLocale: LocaleSchema.nullable().optional(),
    role: z.enum(['admin', 'staff', 'customer']).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const UpdateMyProfileSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const ChangeMyPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: BusinessPasswordSchema,
    passwordConfirmation: z.string().min(1).max(128),
  })
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
  });

export const InviteStaffSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: JapanesePhoneSchema,
  currentAddress: z.string().trim().min(1).max(300),
  jobTitle: z.string().trim().min(1).max(120),
  employeeCode: z.string().trim().min(1).max(50),
});

export const UpdateStaffSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  phone: JapanesePhoneSchema.optional(),
  currentAddress: z.string().trim().min(1).max(300).optional(),
  jobTitle: z.string().trim().min(1).max(120).optional(),
  employeeCode: z.string().trim().min(1).max(50).optional(),
});

export const UpdateStaffStatusSchema = z.object({ isActive: z.boolean() });
export const StaffUserParamSchema = z.object({ userId: z.string().uuid() });

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type UpdateMyProfileDto = z.infer<typeof UpdateMyProfileSchema>;
export type ChangeMyPasswordDto = z.infer<typeof ChangeMyPasswordSchema>;
export type InviteStaffDto = z.infer<typeof InviteStaffSchema>;
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;
