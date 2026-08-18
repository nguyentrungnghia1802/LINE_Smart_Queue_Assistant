import { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { logMonitoringClient } from '../log-monitoring';
import { paymentsService } from '../payments/payments.service';

import { ordersService } from './orders.service';
import { CreateOrderDto, UpdateOrderPaymentDto, UpdateOrderStatusDto } from './orders.validator';

function requireOperationalScope(req: Request): { organizationId: string; branchId: string } {
  const user = req.user;
  if (!user?.organizationId) throw AppError.badRequest('User has no organization');
  if (user.isOrganizationOwner) {
    throw AppError.forbidden('Organization owner does not operate branch orders');
  }
  if (user.role !== UserRole.MANAGER && user.role !== UserRole.STAFF) {
    throw AppError.forbidden('Branch staff or manager access is required');
  }
  if (user.branchIds?.length !== 1) {
    throw AppError.forbidden('Order operations require exactly one assigned branch');
  }
  return { organizationId: user.organizationId, branchId: user.branchIds[0] };
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const status = req.query.status as string | undefined;
  const orders = await ordersService.getByOrg(organizationId, branchId, status);
  sendSuccess(res, orders);
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const order = await ordersService.getById(req.params.id, organizationId, branchId);
  sendSuccess(res, order);
});

export const getOrderReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const order = await ordersService.getReceipt(req.params.id, organizationId, branchId);
  sendSuccess(res, order);
});

export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const stats = await ordersService.getStats(organizationId, branchId);
  sendSuccess(res, stats);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('LINE authentication is required', 401, 'LINE_AUTH_REQUIRED');
  }
  if (req.user.role !== UserRole.CUSTOMER) {
    throw new AppError(
      'Customer account is required to create a booking',
      403,
      'CUSTOMER_ACCOUNT_REQUIRED'
    );
  }
  if (!req.user.lineUserId) {
    throw new AppError(
      'Verified LINE account is required to create a booking',
      403,
      'LINE_ACCOUNT_REQUIRED'
    );
  }

  const actor = { userId: req.user.id, lineUserId: req.user.lineUserId };
  let result: Awaited<ReturnType<typeof ordersService.create>>;
  try {
    result = await ordersService.create(req.body as CreateOrderDto, actor);
  } catch (error) {
    logMonitoringClient.error(
      'ORDER_CREATE_FAILED',
      'Order creation failed',
      error,
      { organizationId: req.user.organizationId },
      { requestId: typeof req.id === 'string' ? req.id : undefined }
    );
    throw error;
  }
  res.status(201).json({ success: true, data: { order: result.order, queueEntry: result.entry } });
});

export const patchOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const order = await ordersService.updateStatus(
    req.params.id,
    organizationId,
    branchId,
    req.body as UpdateOrderStatusDto,
    { userId: req.user?.id ?? '', role: req.user?.role ?? '' }
  );
  sendSuccess(res, order);
});

export const patchOrderPayment = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const order = await ordersService.updatePayment(
    req.params.id,
    organizationId,
    branchId,
    req.body as UpdateOrderPaymentDto,
    req.user?.id ?? '',
    req.header('Idempotency-Key') ?? `manual-payment:${req.params.id}:${Date.now()}`
  );
  sendSuccess(res, order);
});

export const createOrderPaymentQr = asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, branchId } = requireOperationalScope(req);
  const payment = await paymentsService.createCounterPayment({
    orderId: req.params.id,
    organizationId,
    branchId,
  });
  sendSuccess(res, payment);
});

/** Public cancel — customer cancels their own order by orderId. */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw AppError.unauthorized();
  const order = await ordersService.cancelByOrderId(req.params.id, {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    branchIds: user.branchIds,
    isOrganizationOwner: user.isOrganizationOwner,
  });
  sendSuccess(res, order);
});
