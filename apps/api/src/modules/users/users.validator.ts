import { z } from 'zod';

export const CreateUserSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'staff', 'customer']).default('customer'),
});

export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    role: z.enum(['admin', 'staff', 'customer']).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
