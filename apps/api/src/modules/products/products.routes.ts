import { Router } from 'express';

import { UserRole } from '@line-queue/shared';

import { authenticatedActionRateLimiter, publicReadRateLimiter } from '../../middlewares';
import { requireAuth } from '../../middlewares/requireAuth.middleware';
import { requireRole } from '../../middlewares/requireRole.middleware';
import { validate } from '../../middlewares/validate.middleware';

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from './products.controller';
import { CreateProductSchema, UpdateProductSchema } from './products.validator';

export const productsRouter = Router();

// Public + staff: list and get
productsRouter.get('/', publicReadRateLimiter, listProducts);
productsRouter.get('/:id', publicReadRateLimiter, getProduct);

// Manager only: mutate
productsRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(CreateProductSchema),
  createProduct
);

productsRouter.patch(
  '/:id',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  validate(UpdateProductSchema),
  updateProduct
);

productsRouter.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  authenticatedActionRateLimiter,
  deleteProduct
);
