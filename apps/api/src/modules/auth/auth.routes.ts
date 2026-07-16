import { Router } from 'express';

import { strictRateLimiter } from '../../middlewares';
import { validate } from '../../middlewares/validate.middleware';

import { loginWithEmailPassword, loginWithLine, registerCustomer } from './auth.controller';
import {
  EmailPasswordLoginSchema,
  LineLoginSchema,
  RegisterCustomerSchema,
} from './auth.validator';

export const authRouter = Router();

authRouter.post('/line', strictRateLimiter, validate(LineLoginSchema), loginWithLine);
authRouter.post(
  '/login',
  strictRateLimiter,
  validate(EmailPasswordLoginSchema),
  loginWithEmailPassword
);

authRouter.post('/register', strictRateLimiter, validate(RegisterCustomerSchema), registerCustomer);
