import { z } from 'zod';

export const UpdateLocationConsentSchema = z.object({ enabled: z.boolean() });
