import { z } from 'zod';

import { BusinessPasswordSchema } from '../shared/shared.validator';

const ActionTokenSchema = z.string().min(32).max(256);

export const InspectAccountActionSchema = z.object({
  token: ActionTokenSchema,
});

export const CompleteAccountActionSchema = z
  .object({
    token: ActionTokenSchema,
    password: BusinessPasswordSchema,
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
