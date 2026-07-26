import type { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { config } from '../../config';
import { BaseRepository } from '../../db/repositories/base.repository';

import type { EmailDeliveryStatus, EmailTemplateKey } from './email.types';

export interface EmailOutboxRow {
  id: string;
  event_key: string;
  recipient_email: string;
  template_key: EmailTemplateKey;
  locale: SupportedLocale;
  template_data: Record<string, unknown>;
  encrypted_action_token: string;
  status: EmailDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: Date;
  processing_started_at: Date | null;
  sent_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueEmailParams {
  eventKey: string;
  recipientEmail: string;
  templateKey: EmailTemplateKey;
  locale: SupportedLocale;
  templateData: Record<string, unknown>;
  encryptedActionToken: string;
}

export function sanitizeEmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(password|token|authorization)=?[^,\s]*/gi, '$1=[redacted]')
    .slice(0, 500);
}

export class EmailOutboxRepository extends BaseRepository {
  async enqueue(params: EnqueueEmailParams, client: PoolClient): Promise<EmailOutboxRow> {
    const rows = await this.queryTx<EmailOutboxRow>(
      client,
      `INSERT INTO email_outbox (
         event_key, recipient_email, template_key, locale, template_data,
         encrypted_action_token, max_attempts
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (event_key) DO UPDATE SET updated_at = email_outbox.updated_at
       RETURNING *`,
      [
        params.eventKey,
        params.recipientEmail,
        params.templateKey,
        params.locale,
        JSON.stringify(params.templateData),
        params.encryptedActionToken,
        config.email.maxAttempts,
      ]
    );
    return this.firstOrThrow(rows, 'emailOutbox.enqueue');
  }

  async claimDue(limit: number): Promise<EmailOutboxRow[]> {
    return this.query<EmailOutboxRow>(
      `WITH due AS (
         SELECT id
         FROM email_outbox
         WHERE (
           status = 'pending' AND next_retry_at <= NOW()
         ) OR (
           status = 'processing'
           AND processing_started_at < NOW() - ($2 * INTERVAL '1 second')
         )
         ORDER BY next_retry_at, created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE email_outbox e
       SET status = 'processing',
           processing_started_at = NOW(),
           attempt_count = e.attempt_count + 1,
           last_error = NULL,
           updated_at = NOW()
       FROM due
       WHERE e.id = due.id
       RETURNING e.*`,
      [limit, config.email.processingTimeoutSeconds]
    );
  }

  async markSent(id: string): Promise<void> {
    await this.query(
      `UPDATE email_outbox
       SET status = 'sent',
           sent_at = NOW(),
           processing_started_at = NULL,
           encrypted_action_token = '',
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async markRetry(id: string, nextRetryAt: Date, error: unknown): Promise<void> {
    await this.query(
      `UPDATE email_outbox
       SET status = 'pending',
           next_retry_at = $2,
           processing_started_at = NULL,
           last_error = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [id, nextRetryAt, sanitizeEmailError(error)]
    );
  }

  async markFailed(id: string, error: unknown): Promise<void> {
    await this.query(
      `UPDATE email_outbox
       SET status = 'failed',
           processing_started_at = NULL,
           last_error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, sanitizeEmailError(error)]
    );
  }
}

export const emailOutboxRepository = new EmailOutboxRepository();
