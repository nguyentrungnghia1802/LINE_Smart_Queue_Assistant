import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  PenaltyReason,
  QueueStatus,
  TicketStatus,
} from '@line-queue/shared';

describe('shared domain enum contract', () => {
  it('matches PostgreSQL queue and ticket lifecycle values', () => {
    expect(Object.values(QueueStatus)).toEqual(['open', 'paused', 'closed', 'archived']);
    expect(Object.values(TicketStatus)).toEqual([
      'waiting',
      'called',
      'serving',
      'served',
      'skipped',
      'cancelled',
      'no_show',
    ]);
  });

  it('matches PostgreSQL payment, penalty, and notification delivery values', () => {
    expect(Object.values(PaymentStatus)).toEqual([
      'unpaid',
      'pending',
      'authorized',
      'paid',
      'refunded',
      'failed',
      'cancelled',
    ]);
    expect(Object.values(PenaltyReason)).toEqual([
      'no_show',
      'late_arrival',
      'excessive_cancel',
      'manual',
    ]);
    expect(Object.values(NotificationChannel)).toEqual(['line_push', 'email', 'sms', 'in_app']);
    expect(Object.values(NotificationStatus)).toEqual([
      'pending',
      'processing',
      'sent',
      'failed',
      'cancelled',
    ]);
  });

  it('matches the notification event types enforced by the current schema', () => {
    expect(Object.values(NotificationType)).toEqual([
      'booking_created',
      'eta_warning',
      'called',
      'serving',
      'completed',
      'cancelled',
      'no_show',
      'deferred',
      'location_warning',
    ]);
  });
});
