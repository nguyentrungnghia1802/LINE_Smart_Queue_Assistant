import { Request, Response } from 'express';

import type { ProductRow } from '../../db/repositories/products.repository';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { productsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './products.validator';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.query.orgId as string | undefined;
  const orgSlug = req.query.orgSlug as string | undefined;

  let products: ProductRow[];
  if (orgSlug) {
    products = await productsService.getByOrgSlug(orgSlug);
  } else if (orgId) {
    products = await productsService.getByOrg(orgId);
  } else {
    products = [];
  }
  sendSuccess(res, products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.getById(req.params.id);
  const canReadInactive =
    req.user?.organizationId === product.organization_id &&
    ['manager', 'admin'].includes(req.user.role);
  if (!product.is_active && !canReadInactive) {
    throw AppError.notFound('Product not found');
  }
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const actorUserId = req.user?.id;
  if (!orgId || !actorUserId) throw AppError.badRequest('User has no organization');

  const product = await productsService.create(orgId, req.body as CreateProductDto, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const actorUserId = req.user?.id;
  if (!orgId || !actorUserId) throw AppError.badRequest('User has no organization');

  const product = await productsService.update(req.params.id, orgId, req.body as UpdateProductDto, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const actorUserId = req.user?.id;
  if (!orgId || !actorUserId) throw AppError.badRequest('User has no organization');

  await productsService.remove(req.params.id, orgId, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendSuccess(res, null);
});
