import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import {
  authenticatedActionRateLimiter,
  idempotencyMiddleware,
  publicWriteRateLimiter,
  strictRateLimiter,
} from '../../middlewares';
import { requireAuth } from '../../middlewares/requireAuth.middleware';
import { requireRole } from '../../middlewares/requireRole.middleware';
import { validate } from '../../middlewares/validate.middleware';

import {
  completeDemoPayment,
  createPaymentIntent,
  getPaymentReturnStatus,
  handlePaymentWebhook,
  reconcilePayment,
} from './payments.controller';
import {
  CompleteDemoPaymentSchema,
  CreatePaymentIntentSchema,
  PaymentProviderParamSchema,
  PaymentTransactionParamSchema,
} from './payments.validator';

export const paymentsRouter = Router();

paymentsRouter.post(
  '/intents',
  publicWriteRateLimiter,
  idempotencyMiddleware(),
  validate(CreatePaymentIntentSchema),
  createPaymentIntent
);

paymentsRouter.post(
  '/demo/complete',
  publicWriteRateLimiter,
  validate(CompleteDemoPaymentSchema),
  completeDemoPayment
);

paymentsRouter.get(
  '/:transactionId/return',
  validate(PaymentTransactionParamSchema, 'params'),
  getPaymentReturnStatus
);

paymentsRouter.post(
  '/:transactionId/reconcile',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(PaymentTransactionParamSchema, 'params'),
  reconcilePayment
);

paymentsRouter.post(
  '/webhooks/:provider',
  strictRateLimiter,
  validate(PaymentProviderParamSchema, 'params'),
  handlePaymentWebhook
);
