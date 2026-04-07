import { Request, Response } from 'express';

import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { logger } from '../../utils/logger';

import { handleWebhookEvents, verifyLineSignature } from './line.service';
import { LineWebhookBody } from './line.types';

/**
 * POST /api/v1/line/webhook
 *
 * 1. Validate X-Line-Signature (HMAC-SHA256, channel secret).
 * 2. Parse the body as a LINE WebhookBody.
 * 3. Respond 200 immediately — LINE requires a timely response.
 * 4. Process events asynchronously (fire-and-forget with error logging).
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-line-signature'];

  if (typeof signature !== 'string') {
    throw AppError.unauthorized('Missing X-Line-Signature header');
  }

  // Verify signature against raw body string.
  // express.json() has already parsed req.body; we re-stringify to verify.
  const rawBody = JSON.stringify(req.body);
  if (!verifyLineSignature(rawBody, signature)) {
    throw AppError.unauthorized('Invalid LINE signature');
  }

  // Respond 200 immediately — LINE platform expects <1s response.
  res.sendStatus(200);

  // Process asynchronously so a slow handler cannot delay the LINE ack.
  const body = req.body as LineWebhookBody;
  handleWebhookEvents(body).catch((err: unknown) => {
    logger.error({ err }, 'Error processing LINE webhook events');
  });
});
