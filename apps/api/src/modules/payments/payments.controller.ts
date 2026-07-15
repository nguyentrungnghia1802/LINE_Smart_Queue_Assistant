import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendCreated, sendSuccess } from '../../utils/response';

import { paymentsService } from './payments.service';
import { CompleteDemoPaymentDto, CreatePaymentIntentDto } from './payments.validator';

export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
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
  const result = await paymentsService.handleWebhook(
    req.params.provider as never,
    rawBody,
    req.headers
  );
  sendSuccess(res, { received: true, duplicate: result.duplicate });
});

export const reconcilePayment = asyncHandler(async (req: Request, res: Response) => {
  const transaction = await paymentsService.reconcile(req.params.transactionId);
  sendSuccess(res, transaction);
});
