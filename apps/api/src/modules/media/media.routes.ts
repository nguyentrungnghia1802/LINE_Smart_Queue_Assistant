import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  requireAuth,
  requireRole,
  validate,
} from '../../middlewares';

import { deleteImage, uploadImage } from './media.controller';
import { MediaParamsSchema, UploadMediaSchema } from './media.validator';

export const mediaRouter = Router();

mediaRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));
mediaRouter.post('/', authenticatedActionRateLimiter, validate(UploadMediaSchema), uploadImage);
mediaRouter.delete(
  '/:id',
  authenticatedActionRateLimiter,
  validate(MediaParamsSchema, 'params'),
  deleteImage
);
