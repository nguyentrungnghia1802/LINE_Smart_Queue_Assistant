import { z } from 'zod';

/** Body schema for POST /api/v1/auth/line */
export const LineLoginSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

export type LineLoginDto = z.infer<typeof LineLoginSchema>;
