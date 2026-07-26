import { Router } from 'express';

import { strictRateLimiter, validate } from '../../middlewares';

import {
  activateAccount,
  forgotPassword,
  inspectAccountAction,
  resetPassword,
} from './account-lifecycle.controller';
import {
  CompleteAccountActionSchema,
  ForgotPasswordSchema,
  InspectAccountActionSchema,
} from './account-lifecycle.validator';

export const accountLifecycleRouter = Router();

accountLifecycleRouter.get(
  '/account-action',
  strictRateLimiter,
  validate(InspectAccountActionSchema, 'query'),
  inspectAccountAction
);
accountLifecycleRouter.post(
  '/activate-account',
  strictRateLimiter,
  validate(CompleteAccountActionSchema),
  activateAccount
);
accountLifecycleRouter.post(
  '/forgot-password',
  strictRateLimiter,
  validate(ForgotPasswordSchema),
  forgotPassword
);
accountLifecycleRouter.post(
  '/reset-password',
  strictRateLimiter,
  validate(CompleteAccountActionSchema),
  resetPassword
);
