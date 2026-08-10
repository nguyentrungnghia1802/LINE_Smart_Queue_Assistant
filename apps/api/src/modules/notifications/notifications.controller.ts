import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { requireBranchManager } from '../branches/branch-scope';

import type { NotificationOperationScope } from './notification-operations.repository';
import { notificationOperationsService } from './notification-operations.service';
import { notificationsService } from './notifications.service';

/**
 * Derive notification-operation scope entirely from authenticated server-side
 * context.  Admin, organization-owner, and customer roles are rejected.
 *
 * - Branch Manager → sees all queues within their assigned branch.
 * - Staff → sees only their single assigned queue.
 *
 * No client-supplied organizationId/branchId is trusted for authorization.
 */
export function resolveNotificationOperationScope(req: Request): NotificationOperationScope {
  if (!req.user) throw AppError.unauthorized();

  // Admin and organization owner are explicitly denied.
  if (req.user.role === 'admin') {
    throw AppError.forbidden('Platform admin cannot access tenant notification operations');
  }
  if (req.user.isOrganizationOwner) {
    throw AppError.forbidden('Organization owner cannot access notification operations');
  }

  // Staff: queue-scoped only
  if (req.user.role === 'staff') {
    if (!req.user.organizationId) throw AppError.badRequest('User has no organization');
    const branchIds = req.user.branchIds ?? [];
    if (branchIds.length !== 1) {
      throw AppError.forbidden('Staff must have exactly one active branch assignment');
    }
    if (!req.user.assignedQueueId) {
      throw AppError.forbidden('Staff must have an assigned queue');
    }
    return {
      organizationId: req.user.organizationId,
      branchId: branchIds[0],
      queueId: req.user.assignedQueueId,
    };
  }

  // Branch Manager: branch-scoped (all queues within branch)
  const scope = requireBranchManager(req.user);
  // Allow optional queueId filter from query (within their branch)
  const requestedQueue = req.query.queueId as string | undefined;
  return {
    ...scope,
    queueId: requestedQueue || undefined,
  };
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

  // Staff cannot cancel notifications — only branch managers can.
  if (req.user.role === 'staff') {
    throw AppError.forbidden('Staff cannot cancel notifications');
  }

  const data = await notificationOperationsService.cancel({
    id: req.params.id,
    scope: resolveNotificationOperationScope(req),
    actorId: req.user.id,
    reason: req.body.reason,
  });
  sendSuccess(res, data);
});
