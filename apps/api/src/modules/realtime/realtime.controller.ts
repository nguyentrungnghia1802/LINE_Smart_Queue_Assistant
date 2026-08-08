import type { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';

import { realtimeService } from './realtime.service';
import type { RealtimeQueueParams, RealtimeTicketParams } from './realtime.validator';

export const streamTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { entryId } = req.params as unknown as RealtimeTicketParams;
  await realtimeService.openTicketStream(req, res, req.user, entryId);
});

export const streamQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const { queueId } = req.params as unknown as RealtimeQueueParams;
  await realtimeService.openQueueStream(req, res, req.user, queueId);
});
