import fs from 'node:fs';
import path from 'node:path';

import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  PenaltyReason,
  QueueStatus,
  TicketStatus,
} from '@line-queue/shared';

const repositoryRoot = path.resolve(__dirname, '../../../../../..');

function extractPaymentStatusValues(sql: string): string[] {
  const declaration = sql.match(/CREATE TYPE payment_status AS ENUM \(([\s\S]*?)\);/);
  if (!declaration) throw new Error('payment_status enum declaration is missing');

  return [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

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

  it('keeps the reset payment enum order aligned with canonical migration history', () => {
    const initialMigration = fs.readFileSync(
      path.join(repositoryRoot, 'db/migrations/node-pg-migrate/000001_create_full_schema.js'),
      'utf8'
    );
    const paymentFoundationMigration = fs.readFileSync(
      path.join(
        repositoryRoot,
        'db/migrations/node-pg-migrate/000006_payment_production_foundation.js'
      ),
      'utf8'
    );
    const resetSchema = fs.readFileSync(
      path.join(repositoryRoot, 'db/schema/reset_line_queue_schema.sql'),
      'utf8'
    );
    const appendedValues = [
      ...paymentFoundationMigration.matchAll(
        /ALTER TYPE payment_status ADD VALUE IF NOT EXISTS '([^']+)'/g
      ),
    ].map((match) => match[1]);

    expect(extractPaymentStatusValues(resetSchema)).toEqual([
      ...extractPaymentStatusValues(initialMigration),
      ...appendedValues,
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
