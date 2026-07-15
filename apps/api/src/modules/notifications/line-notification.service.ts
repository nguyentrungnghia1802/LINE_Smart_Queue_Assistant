import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';
import type { ILineMessagingAdapter, LineMessage } from '../line/line.adapter';
import { lineMessagingAdapter } from '../line/line.messaging';

export interface LineNotificationContext {
  entryId?: string;
  eventType?: string;
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
    try {
      await adapter.pushMessage(lineUserId, messages, { notificationDisabled: false });
      metricsService.increment('notifications_sent_total');
      logger.info(
        {
          entryId: context.entryId,
          eventType: context.eventType,
          lineUserId,
        },
        'LINE notification sent'
      );
      return true;
    } catch (err) {
      metricsService.increment('notifications_failed_total');
      logger.error(
        {
          err,
          entryId: context.entryId,
          eventType: context.eventType,
        },
        'Failed to send LINE notification'
      );
      return false;
    }
  },
};
