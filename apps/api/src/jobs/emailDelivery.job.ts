import { config } from '../config';
import { emailAdapter } from '../modules/email/email.messaging';
import { renderAccountEmail } from '../modules/email/email.templates';
import type { IEmailAdapter } from '../modules/email/email.types';
import {
  type EmailOutboxRepository,
  emailOutboxRepository,
  type EmailOutboxRow,
} from '../modules/email/email-outbox.repository';
import { decryptEmailActionToken } from '../modules/email/email-token.crypto';
import { logger } from '../utils/logger';
import { metricsService } from '../utils/metrics';

export interface EmailDeliveryOptions {
  repository?: EmailOutboxRepository;
  adapter?: IEmailAdapter;
  now?: () => Date;
  batchSize?: number;
}

function templateString(row: EmailOutboxRow, key: string, fallback: string): string {
  const value = row.template_data[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function actionUrl(row: EmailOutboxRow, token: string): string {
  const path = row.template_key === 'account_activation' ? '/activate-account' : '/reset-password';
  return `${config.web.origin.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token)}`;
}

export function calculateEmailRetryAt(attemptCount: number, now: Date): Date {
  const seconds = config.email.retryBaseSeconds * 2 ** Math.max(0, attemptCount - 1);
  return new Date(now.getTime() + seconds * 1000);
}

export async function deliverEmail(
  row: EmailOutboxRow,
  options: Required<Pick<EmailDeliveryOptions, 'repository' | 'adapter' | 'now'>>
): Promise<void> {
  const { repository, adapter, now } = options;
  try {
    const token = decryptEmailActionToken(row.encrypted_action_token);
    const rendered = renderAccountEmail({
      templateKey: row.template_key,
      locale: row.locale,
      actionUrl: actionUrl(row, token),
      displayName: templateString(row, 'displayName', 'Customer'),
      organizationName: templateString(row, 'organizationName', 'Smart Queue Assistant'),
      expiresIn: templateString(row, 'expiresIn', ''),
    });
    await adapter.send({
      id: row.id,
      to: row.recipient_email,
      fromName: config.email.fromName,
      fromAddress: config.email.fromAddress,
      ...rendered,
    });
    await repository.markSent(row.id);
    metricsService.increment('email_outbox_sent_total');
  } catch (error) {
    if (row.attempt_count >= row.max_attempts) {
      await repository.markFailed(row.id, error);
      metricsService.increment('email_outbox_failed_total');
      return;
    }
    await repository.markRetry(row.id, calculateEmailRetryAt(row.attempt_count, now()), error);
    metricsService.increment('email_outbox_retry_scheduled_total');
  }
}

export async function runEmailDelivery(options: EmailDeliveryOptions = {}): Promise<void> {
  const repository = options.repository ?? emailOutboxRepository;
  const adapter = options.adapter ?? emailAdapter;
  const now = options.now ?? (() => new Date());
  const rows = await repository.claimDue(options.batchSize ?? config.email.deliveryBatchSize);

  for (const row of rows) {
    try {
      await deliverEmail(row, { repository, adapter, now });
    } catch (error) {
      logger.error({ err: error, emailId: row.id }, 'emailDelivery.unexpected-row-error');
    }
  }
}
