import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  idempotencyMiddleware,
  publicWriteRateLimiter,
} from '../../middlewares';
import { requireAuth } from '../../middlewares/requireAuth.middleware';
import { requireRole } from '../../middlewares/requireRole.middleware';
import { validate } from '../../middlewares/validate.middleware';

import {
  cancelOrder,
  createOrder,
  getOrder,
  getOrderStats,
  listOrders,
  patchOrderPayment,
  patchOrderStatus,
} from './orders.controller';
import {
  CreateOrderSchema,
  UpdateOrderPaymentSchema,
  UpdateOrderStatusSchema,
} from './orders.validator';

export const ordersRouter = Router();

// Public: create order (guest customers scanning QR)
ordersRouter.post(
  '/',
  publicWriteRateLimiter,
  idempotencyMiddleware(),
  validate(CreateOrderSchema),
  createOrder
);

// Authenticated customer/staff/manager cancel with ownership/org checks in service
ordersRouter.post('/:id/cancel', requireAuth, authenticatedActionRateLimiter, cancelOrder);

// Authenticated staff/manager
ordersRouter.get(
  '/',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  listOrders
);
ordersRouter.get(
  '/stats',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  getOrderStats
);
ordersRouter.get(
  '/:id',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  getOrder
);
ordersRouter.patch(
  '/:id/status',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(UpdateOrderStatusSchema),
  patchOrderStatus
);
ordersRouter.patch(
  '/:id/payment',
  requireAuth,
  requireRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  idempotencyMiddleware(),
  validate(UpdateOrderPaymentSchema),
  patchOrderPayment
);
