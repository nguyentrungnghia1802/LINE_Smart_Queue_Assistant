import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';
import type { ILineMessagingAdapter, LineMessage } from '../line/line.adapter';
import { lineMessagingAdapter } from '../line/line.messaging';

import type { TicketNotificationTemplate } from './line-notification.templates';

export interface LineNotificationContext {
  entryId?: string;
  eventType?: string;
  retryKey?: string;
}

async function tryPushMessages(
  lineUserId: string,
  messages: LineMessage[],
  context: LineNotificationContext,
  adapter: ILineMessagingAdapter,
  options: { countFailure: boolean; failureMessage: string }
): Promise<boolean> {
  try {
    await adapter.pushMessage(lineUserId, messages, {
      notificationDisabled: false,
      retryKey: context.retryKey,
    });
    metricsService.increment('notifications_sent_total');
    logger.info(
      {
        entryId: context.entryId,
        eventType: context.eventType,
        lineUserId,
        messageType: messages.map((message) => message.type).join(','),
      },
      'LINE notification sent'
    );
    return true;
  } catch (err) {
    if (options.countFailure) {
      metricsService.increment('notifications_failed_total');
    }
    logger.error(
      {
        err,
        entryId: context.entryId,
        eventType: context.eventType,
        messageType: messages.map((message) => message.type).join(','),
      },
      options.failureMessage
    );
    return false;
  }
}

export const lineNotificationService = {
  async pushText(
    lineUserId: string,
    text: string,
    context: LineNotificationContext = {},
    adapter: ILineMessagingAdapter = lineMessagingAdapter
  ): Promise<boolean> {
    return this.pushMessages(lineUserId, [{ type: 'text', text }], context, adapter);
  },

  async pushMessages(
    lineUserId: string,
    messages: LineMessage[],
    context: LineNotificationContext = {},
    adapter: ILineMessagingAdapter = lineMessagingAdapter
  ): Promise<boolean> {
    return tryPushMessages(lineUserId, messages, context, adapter, {
      countFailure: true,
      failureMessage: 'Failed to send LINE notification',
    });
  },

  async pushTicketNotification(
    lineUserId: string,
    notification: TicketNotificationTemplate,
    context: LineNotificationContext = {},
    adapter: ILineMessagingAdapter = lineMessagingAdapter
  ): Promise<boolean> {
    const flexSent = await tryPushMessages(
      lineUserId,
      [notification.flexMessage],
      context,
      adapter,
      {
        countFailure: false,
        failureMessage: 'Failed to send LINE Flex notification; trying text fallback',
      }
    );

    if (flexSent) return true;

    const textContext = context.retryKey
      ? { ...context, retryKey: alternateRetryKey(context.retryKey) }
      : context;
    return tryPushMessages(
      lineUserId,
      [{ type: 'text', text: notification.textMessage }],
      textContext,
      adapter,
      {
        countFailure: true,
        failureMessage: 'Failed to send LINE text fallback notification',
      }
    );
  },
};

function alternateRetryKey(value: string): string {
  const last = value.at(-1) ?? '0';
  const replacement = ((Number.parseInt(last, 16) || 0) ^ 1).toString(16);
  return `${value.slice(0, -1)}${replacement}`;
}
