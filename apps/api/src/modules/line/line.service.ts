import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { normalizeLocale, type SupportedLocale } from '../../i18n/locale';
import { logger } from '../../utils/logger';
import {
  activeTicketStatusMessage,
  cancelFailedMessage,
  cancelSucceededMessage,
  followWelcomeMessage,
  helpMessage,
  noActiveTicketMessage,
  noCancellableTicketMessage,
  skipFailedMessage,
  skipSucceededMessage,
  ticketCancelledMessage,
  unknownCommandMessage,
} from '../notifications/line-notification.templates';
import { notificationPreferencesRepository } from '../notifications/notification-preferences.repository';
import { queueService } from '../queue/queue.service';

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
      await handleUnfollow(event);
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

async function resolveLineUserLocale(lineUserId?: string): Promise<SupportedLocale> {
  if (!lineUserId) return 'ja';
  const user = await usersRepository.findByLineUserId(lineUserId);
  return normalizeLocale(user?.preferred_locale) ?? 'ja';
}

// ── Event handlers ─────────────────────────────────────────────────────────────

async function handleFollow(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const lineUserId = event.source.userId;
  logger.info({ lineUserId }, 'LINE follow event');

  // Upsert a user + line_account row so the customer is registered in our DB.
  // This ensures push notifications work immediately after they follow.
  if (lineUserId) {
    try {
      let userRow = await usersRepository.findByLineUserId(lineUserId);
      if (!userRow) {
        userRow = await usersRepository.create({
          displayName: 'LINE User',
          role: 'customer',
        });
      }
      await usersRepository.upsertLineAccount({
        userId: userRow.id,
        lineUserId,
        displayName: userRow.display_name,
      });
      await notificationPreferencesRepository.setFollowState(lineUserId, true);
      logger.info(
        { lineRecipient: lineUserId.slice(-6), userId: userRow.id },
        'LINE follow: user upserted'
      );
    } catch (err) {
      logger.error({ err, lineUserId }, 'LINE follow: failed to upsert user');
    }
  }

  if (event.replyToken) {
    const locale = await resolveLineUserLocale(lineUserId);
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: followWelcomeMessage(locale),
      },
    ]);
  }
}

async function handleUnfollow(event: LineEvent): Promise<void> {
  const lineUserId = event.source.userId;
  logger.info({ lineUserId }, 'LINE unfollow event');
  // Mark line_account as unlinked so push notifications are no longer attempted.
  if (lineUserId) {
    try {
      await usersRepository.markLineAccountUnlinked(lineUserId);
      await notificationPreferencesRepository.setFollowState(lineUserId, false);
    } catch (err) {
      logger.error(
        { err, lineRecipient: lineUserId.slice(-6) },
        'LINE unfollow: failed to update account state'
      );
    }
  }
}

async function handleMessage(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  const text = (event.message?.text ?? '').trim().toUpperCase();
  logger.info({ userId, text }, 'LINE message event');

  if (!event.replyToken) return;
  const locale = await resolveLineUserLocale(userId);

  if (text === 'HELP') {
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: helpMessage(locale),
      },
    ]);
    return;
  }

  if (text === 'STATUS') {
    const entries = await queueEntriesRepository.findAllActiveForActor(undefined, userId);

    if (entries.length === 0) {
      await adapter.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: noActiveTicketMessage(locale),
        },
      ]);
      return;
    }

    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: activeTicketStatusMessage(entries, locale) },
    ]);
    return;
  }

  if (text === 'CANCEL') {
    const entries = await queueEntriesRepository.findAllActiveForActor(undefined, userId);

    if (entries.length === 0) {
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: noCancellableTicketMessage(locale) },
      ]);
      return;
    }

    // Cancel the most recent active ticket.
    const target = entries[0];
    await queueService.cancelTicket({ entryId: target.id, actorLineUserId: userId });
    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: ticketCancelledMessage(target.ticket_code, { locale }) },
    ]);
    return;
  }

  // Unrecognised message — send a gentle nudge.
  await adapter.replyMessage(event.replyToken, [
    { type: 'text', text: unknownCommandMessage(locale) },
  ]);
}

async function handlePostback(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  const data = event.postback?.data ?? '';
  const locale = await resolveLineUserLocale(userId);
  logger.info({ userId, data }, 'LINE postback event');

  // Expected format: "action=cancel&entryId=<uuid>"
  const params = new URLSearchParams(data);
  const action = params.get('action');
  const entryId = params.get('entryId');

  if (action === 'cancel' && entryId && event.replyToken) {
    try {
      await queueService.cancelTicket({ entryId, actorLineUserId: userId });
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: cancelSucceededMessage(locale) },
      ]);
    } catch (err) {
      logger.warn({ err, entryId, userId }, 'Postback cancel failed');
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: cancelFailedMessage(locale) },
      ]);
    }
    return;
  }

  if (action === 'skip' && entryId && event.replyToken) {
    try {
      const result = await queueService.skipTicket({ entryId, actorLineUserId: userId });
      await adapter.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: skipSucceededMessage(result.entry.ticket_code, locale),
        },
      ]);
    } catch (err) {
      logger.warn({ err, entryId, userId }, 'Postback skip failed');
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: skipFailedMessage(locale) },
      ]);
    }
    return;
  }

  logger.debug({ action, data }, 'Unhandled LINE postback action');
}
