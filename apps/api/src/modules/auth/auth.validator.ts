import { z } from 'zod';

/** Body schema for POST /api/v1/auth/line */
export const LineLoginSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

export type LineLoginDto = z.infer<typeof LineLoginSchema>;

/** Body schema for POST /api/v1/auth/login */
export const EmailPasswordLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export type EmailPasswordLoginDto = z.infer<typeof EmailPasswordLoginSchema>;
