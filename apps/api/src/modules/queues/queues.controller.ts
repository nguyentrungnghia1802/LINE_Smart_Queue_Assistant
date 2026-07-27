import { NextFunction, Request, Response } from 'express';

import { localeFromAcceptLanguage } from '../../i18n/locale';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/response';
import { requireBranchManager } from '../branches/branch-scope';

import { queuesService } from './queues.service';
import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

/**
 * GET /api/v1/queues
 * List all queues for the authenticated organisation.
 */
export const listQueues = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  const locale =
    req.user?.preferredLocale ??
    req.user?.organizationLocale ??
    localeFromAcceptLanguage(req.get('accept-language')) ??
    'ja';
  const queues = await queuesService.listQueues(scope.organizationId, scope.branchId, locale);
  sendSuccess(res, queues);
});

/**
 * GET /api/v1/queues/:id
 */
export const getQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  const queue = await queuesService.getQueue(req.params['id'] ?? '', scope);
  sendSuccess(res, queue);
});

/**
 * POST /api/v1/queues
 */
export const createQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  const dto: CreateQueueDto = req.body as CreateQueueDto;
  const queue = await queuesService.createQueue(scope, dto);
  sendCreated(res, queue);
});

/**
 * PATCH /api/v1/queues/:id
 */
export const updateQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  const queue = await queuesService.updateQueue(
    req.params['id'] ?? '',
    scope,
    req.body as UpdateQueueDto
  );
  sendSuccess(res, queue);
});

/**
 * PATCH /api/v1/queues/:id/status
 */
export const updateQueueStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  const queue = await queuesService.updateQueueStatus(
    req.params['id'] ?? '',
    scope,
    req.body as UpdateQueueStatusDto
  );
  sendSuccess(res, queue);
});

/**
 * DELETE /api/v1/queues/:id
 */
export const deleteQueue = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = requireBranchManager(req.user);
  await queuesService.deleteQueue(req.params['id'] ?? '', scope);
  sendNoContent(res);
  void next; // keep eslint happy — next always present on asyncHandler
});
