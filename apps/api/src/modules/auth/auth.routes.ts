import { Router } from 'express';

import { strictRateLimiter } from '../../middlewares';
import { validate } from '../../middlewares/validate.middleware';

import { loginWithLine } from './auth.controller';
import { LineLoginSchema } from './auth.validator';

export const authRouter = Router();

/**
 * POST /api/v1/auth/line
 * Rate-limited to prevent OIDC token brute-force.
 */
authRouter.post('/line', strictRateLimiter, validate(LineLoginSchema), loginWithLine);
