import { z } from 'zod';

import { PaginationSchema } from '../shared/shared.validator';

export const BookingGroupListQuerySchema = PaginationSchema;
export const BookingGroupParamsSchema = z.object({ id: z.string().uuid() });
