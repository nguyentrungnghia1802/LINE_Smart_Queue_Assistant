import { Request, Response } from 'express';

import type { ProductRow } from '../../db/repositories/products.repository';
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
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const product = await productsService.create(orgId, req.body as CreateProductDto);
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  const product = await productsService.update(req.params.id, orgId, req.body as UpdateProductDto);
  sendSuccess(res, product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId!;
  await productsService.remove(req.params.id, orgId);
  sendSuccess(res, null);
});
