import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent } from '../../utils/response';

import { mediaService } from './media.factory';

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  sendCreated(res, await mediaService.upload(req.body, req.user));
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  await mediaService.delete(req.params.id, req.user);
  sendNoContent(res);
});
