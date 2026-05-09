import { config } from '../../config';
import { logger } from '../../utils/logger';

import type { ILineMessagingAdapter } from './line.adapter';
import { lineMessagingAdapter } from './line.messaging';
import { verifyLineSignature } from './line.signature';
import type { LineEvent, LineWebhookBody } from './line.types';

// ── Re-export signature helper so callers don't need two imports ───────────────
export { verifyLineSignature };

// ── Webhook event dispatcher ───────────────────────────────────────────────────

/**
 * Dispatch each event in the webhook payload to the appropriate handler.
 *
 * The `adapter` parameter makes the function testable without module mocking:
 *   const mock = new MockLineAdapter();
 *   await handleWebhookEvents(body, mock);
 *   expect(mock.replyCalls).toHaveLength(1);
 */
export async function handleWebhookEvents(
  body: LineWebhookBody,
  adapter: ILineMessagingAdapter = lineMessagingAdapter
): Promise<void> {
  for (const event of body.events) {
    await dispatchEvent(event, adapter);
  }
}

async function dispatchEvent(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  switch (event.type) {
    case 'follow':
      await handleFollow(event, adapter);
      break;
    case 'unfollow':
      handleUnfollow(event);
      break;
    case 'message':
      await handleMessage(event, adapter);
      break;
    case 'postback':
      await handlePostback(event, adapter);
      break;
    default:
      logger.debug({ type: (event as LineEvent).type }, 'Unhandled LINE event type');
  }
}

// ── Event handlers ─────────────────────────────────────────────────────────────

async function handleFollow(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  logger.info({ userId }, 'LINE follow event');

  if (event.replyToken) {
    // TODO: upsert user via usersRepository.upsertLineAccount(userId)
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text:
          '👋 Welcome to LINE Smart Queue!\n\n' +
          'You can join a queue by scanning the QR code at the counter.\n' +
          'Type "STATUS" to see your current tickets, or "HELP" for more commands.',
      },
    ]);
  }
}

function handleUnfollow(event: LineEvent): void {
  // No replyToken available for unfollow events.
  // TODO: mark line_account.is_linked = FALSE via usersRepository.
  logger.info({ userId: event.source.userId }, 'LINE unfollow event');
}

async function handleMessage(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  const text = (event.message?.text ?? '').trim().toUpperCase();
  logger.info({ userId, text }, 'LINE message event');

  if (!event.replyToken) return;

  if (text === 'HELP') {
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text:
          '📋 Available commands:\n' +
          '• STATUS — show your active tickets\n' +
          '• CANCEL — cancel your current ticket\n' +
          '• HELP   — show this message',
      },
    ]);
    return;
  }

  if (text === 'STATUS') {
    // TODO: query queueEntriesRepository.findAllActiveForActor(undefined, userId)
    //       and format the result into a reply message.
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: 'Open the app to view your ticket status: ' + config.cors.origin,
      },
    ]);
    return;
  }

  if (text === 'CANCEL') {
    // TODO: cancel the user's active ticket and confirm via reply.
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: 'To cancel your ticket, please use the app: ' + config.cors.origin,
      },
    ]);
    return;
  }

  // Unrecognised message — send a gentle nudge.
  await adapter.replyMessage(event.replyToken, [
    { type: 'text', text: 'Type "HELP" to see available commands.' },
  ]);
}

async function handlePostback(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  const data = event.postback?.data ?? '';
  logger.info({ userId, data }, 'LINE postback event');

  // Expected format: "action=cancel&entryId=<uuid>"
  const params = new URLSearchParams(data);
  const action = params.get('action');

  if (action === 'cancel' && event.replyToken) {
    // TODO: const entryId = params.get('entryId');
    //       await queueService.cancelTicket({ entryId, actorLineUserId: userId });
    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: '✅ Your ticket has been cancelled.' },
    ]);
    return;
  }

  if (action === 'skip' && event.replyToken) {
    // TODO: await queueService.skipTicket({ entryId, actorLineUserId: userId });
    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: '↩️ Your ticket has been moved back one position.' },
    ]);
    return;
  }

  logger.debug({ action, data }, 'Unhandled LINE postback action');
}
