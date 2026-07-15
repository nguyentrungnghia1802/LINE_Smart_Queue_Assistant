import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';
import { lineMessagingAdapter } from '../line/line.messaging';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'queue_called' | 'eta_update' | 'queue_done' | 'system';
  message: string;
  sentAt: Date;
  readAt: Date | null;
}

export interface SendNotificationParams {
  /** Internal app userId — used to look up lineUserId when not provided. */
  userId?: string;
  /** LINE user ID — if provided, a push message is sent immediately. */
  lineUserId?: string;
  type: NotificationRecord['type'];
  message: string;
}

export const notificationsService = {
  async listForUser(_userId: string): Promise<NotificationRecord[]> {
    return [];
  },

  /**
   * Send a notification to a user.
   *
   * When `lineUserId` is provided the message is pushed via LINE Messaging API.
   * When only `userId` is provided the push is skipped (lineUserId lookup
   * against the DB is deferred to a future implementation).
   *
   * Current implementation sends LINE push messages only.
   * Persistence and alternate delivery channels can be layered on later.
   */
  async send(params: SendNotificationParams): Promise<void> {
    const { lineUserId, type, message } = params;

    if (lineUserId) {
      try {
        await lineMessagingAdapter.pushMessage(lineUserId, [{ type: 'text', text: message }]);
        metricsService.increment('notifications_sent_total');
        logger.debug({ lineUserId, notificationType: type }, 'LINE push message sent');
      } catch (err) {
        // Log and continue — a failed notification must not roll back the
        // business operation that triggered it.
        metricsService.increment('notifications_failed_total');
        logger.error({ err, lineUserId, notificationType: type }, 'Failed to send LINE push');
      }
    } else {
      logger.debug(
        { userId: params.userId, notificationType: type },
        'No lineUserId — skipping LINE push'
      );
    }
  },
};
