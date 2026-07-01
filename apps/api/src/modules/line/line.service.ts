import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { logger } from '../../utils/logger';
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
      logger.info({ lineUserId, userId: userRow.id }, 'LINE follow: user upserted');
    } catch (err) {
      logger.error({ err, lineUserId }, 'LINE follow: failed to upsert user');
    }
  }

  if (event.replyToken) {
    await adapter.replyMessage(event.replyToken, [
      {
        type: 'text',
        text:
          '👋 LINE Smart Queue Assistantへようこそ。\n\n' +
          '店頭のQRコードを読み取ると受付番号を取得できます。\n' +
          '"STATUS"で現在の受付状況、"HELP"で使い方を確認できます。',
      },
    ]);
  }
}

function handleUnfollow(event: LineEvent): void {
  const lineUserId = event.source.userId;
  logger.info({ lineUserId }, 'LINE unfollow event');
  // Mark line_account as unlinked so push notifications are no longer attempted.
  if (lineUserId) {
    usersRepository.markLineAccountUnlinked(lineUserId).catch((err: unknown) => {
      logger.error({ err, lineUserId }, 'LINE unfollow: failed to mark account unlinked');
    });
  }
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
          '📋 利用できるコマンド:\n' +
          '• STATUS — 現在の受付番号を確認\n' +
          '• CANCEL — 現在の受付をキャンセル\n' +
          '• HELP   — この案内を表示',
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
          text:
            '現在有効な受付番号はありません。\n' +
            '店頭のQRコードを読み取って順番待ちに参加してください。',
        },
      ]);
      return;
    }

    const lines = entries
      .map((e) => `• 受付番号 ${e.ticket_code} — ${formatEntryStatus(e.status)}`)
      .join('\n');

    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: `現在の受付番号:\n${lines}` },
    ]);
    return;
  }

  if (text === 'CANCEL') {
    const entries = await queueEntriesRepository.findAllActiveForActor(undefined, userId);

    if (entries.length === 0) {
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: 'キャンセルできる有効な受付番号はありません。' },
      ]);
      return;
    }

    // Cancel the most recent active ticket.
    const target = entries[0];
    await queueService.cancelTicket({ entryId: target.id, actorLineUserId: userId });
    await adapter.replyMessage(event.replyToken, [
      { type: 'text', text: `✅ 受付番号 ${target.ticket_code} をキャンセルしました。` },
    ]);
    return;
  }

  // Unrecognised message — send a gentle nudge.
  await adapter.replyMessage(event.replyToken, [
    { type: 'text', text: '"HELP"と入力すると使い方を確認できます。' },
  ]);
}

async function handlePostback(event: LineEvent, adapter: ILineMessagingAdapter): Promise<void> {
  const userId = event.source.userId;
  const data = event.postback?.data ?? '';
  logger.info({ userId, data }, 'LINE postback event');

  // Expected format: "action=cancel&entryId=<uuid>"
  const params = new URLSearchParams(data);
  const action = params.get('action');
  const entryId = params.get('entryId');

  if (action === 'cancel' && entryId && event.replyToken) {
    try {
      await queueService.cancelTicket({ entryId, actorLineUserId: userId });
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: '✅ 受付番号をキャンセルしました。' },
      ]);
    } catch (err) {
      logger.warn({ err, entryId, userId }, 'Postback cancel failed');
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: 'キャンセルできませんでした。すでに処理済みの可能性があります。' },
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
          text: `↩️ 受付番号 ${result.entry.ticket_code} を1つ後ろに移動しました。`,
        },
      ]);
    } catch (err) {
      logger.warn({ err, entryId, userId }, 'Postback skip failed');
      await adapter.replyMessage(event.replyToken, [
        { type: 'text', text: '順番を後ろへ移動できませんでした。もう一度お試しください。' },
      ]);
    }
    return;
  }

  logger.debug({ action, data }, 'Unhandled LINE postback action');
}

function formatEntryStatus(status: string): string {
  const labels: Record<string, string> = {
    waiting: '待機中',
    called: '呼び出し中',
    serving: '対応中',
    completed: '完了',
    cancelled: 'キャンセル済み',
    skipped: 'スキップ済み',
    no_show: '不在',
  };
  return labels[status] ?? status;
}
