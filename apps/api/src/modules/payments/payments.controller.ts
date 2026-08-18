import { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/response';
import { requireBranchManager } from '../branches/branch-scope';
import { logMonitoringClient } from '../log-monitoring';

import { paymentsService } from './payments.service';
import { CompleteDemoPaymentDto, CreatePaymentIntentDto } from './payments.validator';

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== UserRole.CUSTOMER || !req.user.lineUserId) {
    throw new AppError(
      'Verified LINE account is required to create a payment',
      403,
      'LINE_ACCOUNT_REQUIRED'
    );
  }
  const intent = await paymentsService.createIntent(req.body as CreatePaymentIntentDto);
  sendCreated(res, intent);
});

export const completeDemoPayment = asyncHandler(async (req: Request, res: Response) => {
  const dto = req.body as CompleteDemoPaymentDto;
  const transaction = await paymentsService.completeDemoPayment(dto.transactionId, dto.demoToken);
  sendSuccess(res, transaction);
});

export const getPaymentReturnStatus = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await paymentsService.getReturnStatus(req.params.transactionId);
  sendSuccess(res, transaction);
});

export const handlePaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = req.rawBody;
  if (!rawBody) throw AppError.badRequest('Raw payment webhook body is unavailable');
  let result: Awaited<ReturnType<typeof paymentsService.handleWebhook>>;
  try {
    result = await paymentsService.handleWebhook(
      req.params.provider as never,
      rawBody,
      req.headers
    );
  } catch (error) {
    logMonitoringClient.error(
      'PAYMENT_WEBHOOK_FAILED',
      'Payment webhook processing failed',
      error,
      { provider: req.params.provider },
      { requestId: typeof req.id === 'string' ? req.id : undefined }
    );
    throw error;
  }
  sendSuccess(res, { received: true, duplicate: result.duplicate });
});

export const reconcilePayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const scope = req.user.role === UserRole.MANAGER ? requireBranchManager(req.user) : undefined;
  const transaction = await paymentsService.reconcile(req.params.transactionId, scope);
  sendSuccess(res, transaction);
});
