import { NextFunction, Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';

import { queuesService } from './queues.service';
import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

/**
 * GET /api/v1/queues
 * List all queues for the authenticated organisation.
 */
export const listQueues = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  const queues = await queuesService.listQueues(orgId);
  sendSuccess(res, queues);
});

/**
 * GET /api/v1/queues/:id
 */
export const getQueue = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  const queue = await queuesService.getQueue(req.params['id'] ?? '', orgId);
  sendSuccess(res, queue);
});

/**
 * POST /api/v1/queues
 */
export const createQueue = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  const dto: CreateQueueDto = req.body as CreateQueueDto;
  const queue = await queuesService.createQueue(orgId, dto);
  sendCreated(res, queue);
});

/**
 * PATCH /api/v1/queues/:id
 */
export const updateQueue = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  const queue = await queuesService.updateQueue(
    req.params['id'] ?? '',
    orgId,
    req.body as UpdateQueueDto
  );
  sendSuccess(res, queue);
});

/**
 * PATCH /api/v1/queues/:id/status
 */
export const updateQueueStatus = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  const queue = await queuesService.updateQueueStatus(
    req.params['id'] ?? '',
    orgId,
    req.body as UpdateQueueStatusDto
  );
  sendSuccess(res, queue);
});

/**
 * DELETE /api/v1/queues/:id
 */
export const deleteQueue = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const orgId = req.user?.organizationId;
  if (!orgId) throw AppError.forbidden('User has no organization');
  await queuesService.deleteQueue(req.params['id'] ?? '', orgId);
  sendNoContent(res);
  void next; // keep eslint happy — next always present on asyncHandler
});
