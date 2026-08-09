import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { requireBranchManager, requireOrganizationOwner } from '../branches/branch-scope';

import type { NotificationOperationScope } from './notification-operations.repository';
import { notificationOperationsService } from './notification-operations.service';
import { notificationsService } from './notifications.service';

export function resolveNotificationOperationScope(req: Request): NotificationOperationScope {
  if (!req.user) throw AppError.unauthorized();
  if (req.user.role === 'admin') {
    return {
      organizationId: req.query.organizationId as string | undefined,
      branchId: req.query.branchId as string | undefined,
    };
  }
  if (req.user.isOrganizationOwner) {
    return {
      organizationId: requireOrganizationOwner(req.user),
      branchId: req.query.branchId as string | undefined,
    };
  }
  const scope = requireBranchManager(req.user);
  const requestedBranch = req.query.branchId as string | undefined;
  if (requestedBranch && requestedBranch !== scope.branchId) {
    throw AppError.forbidden('Notification is outside your assigned branch');
  }
  return scope;
}

/**
 * GET /api/v1/notifications
 * Returns the authenticated user's recent notifications.
 */
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id ?? '';
  const notifications = await notificationsService.listForUser(userId);
  sendSuccess(res, notifications);
});

export const listNotificationOperations = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const data = await notificationOperationsService.list({
    ...resolveNotificationOperationScope(req),
    status: req.query.status as never,
    eventType: req.query.eventType as never,
    createdFrom: req.query.createdFrom as unknown as Date | undefined,
    createdTo: req.query.createdTo as unknown as Date | undefined,
    page,
    limit,
  });
  sendSuccess(res, data);
});

export const getNotificationOperation = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(
    res,
    await notificationOperationsService.detail(
      req.params.id,
      resolveNotificationOperationScope(req)
    )
  );
});

export const retryNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new Error('Authenticated user context is missing');
  const data = await notificationOperationsService.retry({
    id: req.params.id,
    scope: resolveNotificationOperationScope(req),
    actorId: req.user.id,
    reason: req.body.reason,
  });
  sendSuccess(res, data);
});

export const cancelNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new Error('Authenticated user context is missing');
  const data = await notificationOperationsService.cancel({
    id: req.params.id,
    scope: resolveNotificationOperationScope(req),
    actorId: req.user.id,
    reason: req.body.reason,
  });
  sendSuccess(res, data);
});
