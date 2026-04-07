import { Router } from 'express';

import { strictRateLimiter } from '../../middlewares';

import { handleWebhook } from './line.controller';

export const lineRouter = Router();

/**
 * POST /api/v1/line/webhook
 *
 * Signature verification is performed inside the controller, not as middleware,
 * so that we can access the parsed JSON body (which express.json() already set).
 *
 * strictRateLimiter: 20 req/min per IP — generously sized for LINE's retry logic.
 */
lineRouter.post('/webhook', strictRateLimiter, handleWebhook);
