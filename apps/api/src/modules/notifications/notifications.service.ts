// Notification service skeleton.
// TODO: integrate with LINE Messaging API push/multicast.

export interface NotificationRecord {
  id: string;
  userId: string;
  type: 'queue_called' | 'eta_update' | 'queue_done' | 'system';
  message: string;
  sentAt: Date;
  readAt: Date | null;
}

export const notificationsService = {
  async listForUser(_userId: string): Promise<NotificationRecord[]> {
    // TODO: query notifications table once schema is finalised.
    return [];
  },

  async send(_userId: string, _type: NotificationRecord['type'], _message: string): Promise<void> {
    // TODO: call LINE push message API and persist record.
  },
};
