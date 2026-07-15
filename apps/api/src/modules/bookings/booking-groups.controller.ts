import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../../utils/response';

import { bookingGroupsService } from './booking-groups.service';

export const listMyBookingGroups = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const result = await bookingGroupsService.listMine(req.user.id, page, limit);
  sendPaginated(res, result.items, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
});

export const getBookingGroup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  sendSuccess(res, await bookingGroupsService.getById(req.params.id, req.user));
});
