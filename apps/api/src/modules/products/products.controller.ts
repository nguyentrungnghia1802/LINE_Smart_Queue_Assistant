import { Request, Response } from 'express';

import type { ProductRow } from '../../db/repositories/products.repository';
import { localeFromAcceptLanguage, normalizeLocale } from '../../i18n/locale';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import {
  requireBranchManager,
  requireBranchOperator,
  requireOrganizationOwner,
} from '../branches/branch-scope';

import { productsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './products.validator';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.query.orgId as string | undefined;
  const orgSlug = req.query.orgSlug as string | undefined;
  const locale =
    normalizeLocale(req.query.locale) ??
    localeFromAcceptLanguage(req.get('accept-language')) ??
    'ja';

  let products: ProductRow[];
  if (req.user?.role === 'manager') {
    const organizationId = req.user.isOrganizationOwner
      ? requireOrganizationOwner(req.user)
      : requireBranchManager(req.user).organizationId;
    products = await productsService.getByOrg(organizationId, locale);
  } else if (req.user?.role === 'staff') {
    products = await productsService.getByBranch(requireBranchOperator(req.user).branchId, locale);
  } else if (orgSlug) {
    products = await productsService.getByOrgSlug(orgSlug, locale);
  } else if (orgId) {
    products = await productsService.getByOrg(orgId, locale);
  } else {
    products = [];
  }
  sendSuccess(res, products);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.getById(req.params.id);
  if (req.user?.role === 'manager' && product.organization_id !== req.user.organizationId) {
    throw AppError.forbidden('Product is outside your organization');
  }
  if (req.user?.role === 'staff') {
    const scope = requireBranchOperator(req.user);
    const products = await productsService.getByBranch(scope.branchId);
    if (!products.some((candidate) => candidate.id === product.id)) {
      throw AppError.forbidden('Product is not assigned to your branch queues');
    }
  }
  const canReadInactive =
    req.user?.organizationId === product.organization_id &&
    ['manager', 'staff', 'admin'].includes(req.user.role);
  if (!product.is_active && !canReadInactive) {
    throw AppError.notFound('Product not found');
  }
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const organizationId = requireOrganizationOwner(req.user);
  const actorUserId = req.user?.id;
  if (!actorUserId) throw AppError.badRequest('User has no organization');

  const product = await productsService.create(organizationId, req.body as CreateProductDto, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const organizationId = requireOrganizationOwner(req.user);
  const actorUserId = req.user?.id;
  if (!actorUserId) throw AppError.badRequest('User has no organization');

  const product = await productsService.update(
    req.params.id,
    organizationId,
    req.body as UpdateProductDto,
    {
      actorUserId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }
  );
  sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const organizationId = requireOrganizationOwner(req.user);
  const actorUserId = req.user?.id;
  if (!actorUserId) throw AppError.badRequest('User has no organization');

  await productsService.remove(req.params.id, organizationId, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendSuccess(res, null);
});
