import { Router } from 'express';

import { requireAuth, validate } from '../../middlewares';

import { getBookingGroup, listMyBookingGroups } from './booking-groups.controller';
import { BookingGroupListQuerySchema, BookingGroupParamsSchema } from './booking-groups.validator';

export const bookingGroupsRouter = Router();

bookingGroupsRouter.get(
  '/me',
  requireAuth,
  validate(BookingGroupListQuerySchema, 'query'),
  listMyBookingGroups
);
bookingGroupsRouter.get(
  '/:id',
  requireAuth,
  validate(BookingGroupParamsSchema, 'params'),
  getBookingGroup
);
