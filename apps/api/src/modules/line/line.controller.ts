import { Request, Response } from 'express';

import { config } from '../../config';
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
 *
 * The raw body bytes (set by the express.json verify hook in app.ts) are used
 * for signature verification to ensure byte-for-byte accuracy.
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['x-line-signature'];

  if (typeof signature !== 'string') {
    throw AppError.unauthorized('Missing X-Line-Signature header');
  }

  if (!config.line.channelSecret) {
    throw AppError.serviceUnavailable('LINE webhook channel secret is not configured');
  }

  // Use raw bytes captured before JSON parsing (see app.ts verify hook).
  // Fall back to re-serialised body only if rawBody is unexpectedly absent
  // (should not happen in production; guards against misconfiguration).
  const rawBody: Buffer | string = req.rawBody ?? JSON.stringify(req.body);

  if (!verifyLineSignature(rawBody, signature, config.line.channelSecret)) {
    throw AppError.unauthorized('Invalid LINE signature');
  }

  // Acknowledge immediately — LINE expects a response within 1 second.
  res.sendStatus(200);

  // Process events asynchronously so slow handlers cannot delay the LINE ack.
  const body = req.body as LineWebhookBody;
  handleWebhookEvents(body).catch((err: unknown) => {
    logger.error({ err }, 'Error processing LINE webhook events');
  });
});
