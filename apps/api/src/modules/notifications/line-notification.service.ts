import { captureException } from '../../observability/runtime';
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
): Promise<{ sent: boolean; error?: unknown }> {
  const startedAt = Date.now();
  try {
    await adapter.pushMessage(lineUserId, messages, {
      notificationDisabled: false,
      retryKey: context.retryKey,
    });
    metricsService.increment('notifications_sent_total');
    metricsService.setGauge('line_provider_latency_seconds', (Date.now() - startedAt) / 1_000);
    logger.info(
      {
        entryId: context.entryId,
        eventType: context.eventType,
        messageType: messages.map((message) => message.type).join(','),
      },
      'LINE notification sent'
    );
    return { sent: true };
  } catch (err) {
    metricsService.increment('line_provider_failures_total');
    metricsService.setGauge('line_provider_latency_seconds', (Date.now() - startedAt) / 1_000);
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
    return { sent: false, error: err };
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
    const result = await tryPushMessages(lineUserId, messages, context, adapter, {
      countFailure: true,
      failureMessage: 'Failed to send LINE notification',
    });
    return result.sent;
  },

  async pushTicketNotification(
    lineUserId: string,
    notification: TicketNotificationTemplate,
    context: LineNotificationContext = {},
    adapter: ILineMessagingAdapter = lineMessagingAdapter
  ): Promise<boolean> {
    try {
      await this.pushTicketNotificationOrThrow(lineUserId, notification, context, adapter);
      return true;
    } catch {
      return false;
    }
  },

  async pushTicketNotificationOrThrow(
    lineUserId: string,
    notification: TicketNotificationTemplate,
    context: LineNotificationContext = {},
    adapter: ILineMessagingAdapter = lineMessagingAdapter
  ): Promise<void> {
    const flexResult = await tryPushMessages(
      lineUserId,
      [notification.flexMessage],
      context,
      adapter,
      {
        countFailure: false,
        failureMessage: 'Failed to send LINE Flex notification; trying text fallback',
      }
    );

    if (flexResult.sent) return;

    const textContext = context.retryKey
      ? { ...context, retryKey: alternateRetryKey(context.retryKey) }
      : context;
    const textResult = await tryPushMessages(
      lineUserId,
      [{ type: 'text', text: notification.textMessage }],
      textContext,
      adapter,
      {
        countFailure: true,
        failureMessage: 'Failed to send LINE text fallback notification',
      }
    );
    if (textResult.sent) return;

    const error =
      textResult.error ?? flexResult.error ?? new Error('LINE notification delivery failed');
    captureException(error, {
      operation: 'line.notification.delivery',
      eventType: context.eventType,
      messageType: 'text-fallback',
    });
    throw error;
  },
};

function alternateRetryKey(value: string): string {
  const last = value.at(-1) ?? '0';
  const replacement = ((Number.parseInt(last, 16) || 0) ^ 1).toString(16);
  return `${value.slice(0, -1)}${replacement}`;
}
