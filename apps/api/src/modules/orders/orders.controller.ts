import { Request, Response } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { ordersService } from './orders.service';
import { CreateOrderDto, UpdateOrderPaymentDto, UpdateOrderStatusDto } from './orders.validator';

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const status = req.query.status as string | undefined;
  const orders = await ordersService.getByOrg(orgId, status);
  sendSuccess(res, orders);
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.getById(req.params.id);
  sendSuccess(res, order);
});

export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const stats = await ordersService.getStats(orgId);
  sendSuccess(res, stats);
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await ordersService.create(req.body as CreateOrderDto, req.user?.id);
  res.status(201).json({ success: true, data: { order: result.order, queueEntry: result.entry } });
});

export const patchOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const order = await ordersService.updateStatus(req.params.id, orgId, req.body as UpdateOrderStatusDto);
  sendSuccess(res, order);
});

export const patchOrderPayment = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const order = await ordersService.updatePayment(req.params.id, orgId, req.body as UpdateOrderPaymentDto);
  sendSuccess(res, order);
});

/** Public cancel — customer cancels their own order by orderId. */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await ordersService.cancelByOrderId(req.params.id, req.user?.id);
  sendSuccess(res, order);
});
