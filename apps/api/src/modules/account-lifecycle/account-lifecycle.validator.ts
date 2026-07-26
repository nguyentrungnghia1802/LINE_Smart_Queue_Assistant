import { z } from 'zod';

const ActionTokenSchema = z.string().min(32).max(256);
const NewPasswordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const InspectAccountActionSchema = z.object({
  token: ActionTokenSchema,
});

export const CompleteAccountActionSchema = z
  .object({
    token: ActionTokenSchema,
    password: NewPasswordSchema,
    passwordConfirmation: z.string().min(1).max(128),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export type CompleteAccountActionDto = z.infer<typeof CompleteAccountActionSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
