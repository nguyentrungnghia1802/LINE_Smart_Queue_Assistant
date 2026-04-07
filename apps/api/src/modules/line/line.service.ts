import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../../config';
import { logger } from '../../utils/logger';

import { LineEvent, LineWebhookBody } from './line.types';

/**
 * Verify the X-Line-Signature header to ensure the request came from LINE.
 * Uses HMAC-SHA256 with the channel secret.
 *
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
export function verifyLineSignature(body: string, signature: string): boolean {
  const hmac = createHmac('sha256', config.line.channelSecret).update(body).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Dispatch each event to a dedicated handler stub. */
export async function handleWebhookEvents(body: LineWebhookBody): Promise<void> {
  for (const event of body.events) {
    await dispatchEvent(event);
  }
}

async function dispatchEvent(event: LineEvent): Promise<void> {
  switch (event.type) {
    case 'follow':
      await handleFollow(event);
      break;
    case 'unfollow':
      await handleUnfollow(event);
      break;
    case 'message':
      await handleMessage(event);
      break;
    case 'postback':
      await handlePostback(event);
      break;
    default:
      logger.debug({ type: event.type }, 'Unhandled LINE event type');
  }
}

async function handleFollow(event: LineEvent): Promise<void> {
  // TODO: upsert user via usersRepository.create + upsertLineAccount
  logger.info({ userId: event.source.userId }, 'LINE follow event');
}

async function handleUnfollow(event: LineEvent): Promise<void> {
  // TODO: mark line_account is_linked = FALSE
  logger.info({ userId: event.source.userId }, 'LINE unfollow event');
}

async function handleMessage(event: LineEvent): Promise<void> {
  // TODO: parse text for queue commands (e.g. "STATUS", "LEAVE")
  logger.info({ userId: event.source.userId, text: event.message?.text }, 'LINE message event');
}

async function handlePostback(event: LineEvent): Promise<void> {
  // TODO: parse postback data and route to the appropriate service
  logger.info({ userId: event.source.userId, data: event.postback?.data }, 'LINE postback event');
}
