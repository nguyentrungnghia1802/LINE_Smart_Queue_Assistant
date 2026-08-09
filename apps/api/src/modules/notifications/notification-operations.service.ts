import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';

import type { TicketNotificationEventType } from './line-notification.templates';
import type {
  NotificationOperationFilters,
  NotificationOperationRow,
  NotificationOperationScope,
} from './notification-operations.repository';
import { notificationOperationsRepository } from './notification-operations.repository';
import type { NotificationDeliveryStatus } from './notification-outbox.repository';

export type NotificationFailureCategory =
  | 'blocked_recipient'
  | 'invalid_recipient'
  | 'timeout'
  | 'rate_limited'
  | 'provider_4xx'
  | 'provider_5xx'
  | 'network'
  | 'unknown';

const TERMINAL_TICKET_STATUSES = new Set(['served', 'cancelled', 'no_show']);
const RETRYABLE_FAILURES = new Set<NotificationFailureCategory>([
  'timeout',
  'rate_limited',
  'provider_5xx',
  'network',
  'unknown',
]);

function maskedLineId(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

export function sanitizeOperationalError(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/U[A-Za-z0-9]{8,}/g, '[LINE user redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function classifyNotificationFailure(value: string | null): NotificationFailureCategory {
  const message = value?.toLowerCase() ?? '';
  if (/block(ed)?|not a friend|unfollow/.test(message)) return 'blocked_recipient';
  if (/invalid.*(user|recipient)|recipient.*invalid|not found/.test(message)) {
    return 'invalid_recipient';
  }
  if (/timeout|timed out|etimedout/.test(message)) return 'timeout';
  if (/429|rate.?limit|too many requests/.test(message)) return 'rate_limited';
  if (/\b4\d\d\b|bad request|forbidden|unauthorized/.test(message)) return 'provider_4xx';
  if (/\b5\d\d\b|service unavailable|bad gateway/.test(message)) return 'provider_5xx';
  if (/econn|network|socket|dns|fetch failed/.test(message)) return 'network';
  return 'unknown';
}

function capabilities(row: NotificationOperationRow) {
  const failureCategory = row.last_error ? classifyNotificationFailure(row.last_error) : null;
  return {
    failureCategory,
    canRetry:
      row.status === 'failed' &&
      failureCategory !== null &&
      RETRYABLE_FAILURES.has(failureCategory),
    canCancel:
      row.status === 'pending' &&
      row.ticket_status !== null &&
      TERMINAL_TICKET_STATUSES.has(row.ticket_status),
  };
}

function safeSummary(row: NotificationOperationRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    queueEntryId: row.queue_entry_id,
    queueName: row.queue_name,
    ticketCode: row.ticket_code,
    ticketStatus: row.ticket_status,
    eventType: row.event_type,
    locale: row.locale,
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    manualRetryCount: row.manual_retry_count,
    nextRetryAt: row.next_retry_at,
    sentAt: row.sent_at,
    lineRecipient: maskedLineId(row.line_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...capabilities(row),
  };
}

function safeDetail(row: NotificationOperationRow) {
  return {
    ...safeSummary(row),
    eventKey: row.event_key,
    dispatchStatus: row.dispatch_status,
    dispatchedAt: row.dispatched_at,
    processingStartedAt: row.processing_started_at,
    sanitizedLastError: sanitizeOperationalError(row.last_error),
    operatorNote: row.operator_note,
  };
}

export interface ListNotificationOperationsParams extends NotificationOperationScope {
  status?: NotificationDeliveryStatus;
  eventType?: TicketNotificationEventType;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
}

export const notificationOperationsService = {
  async list(params: ListNotificationOperationsParams) {
    const result = await notificationOperationsRepository.list(
      params as NotificationOperationFilters
    );
    return {
      items: result.rows.map(safeSummary),
      page: params.page,
      limit: params.limit,
      total: result.total,
    };
  },

  async detail(id: string, scope: NotificationOperationScope) {
    const row = await notificationOperationsRepository.findById(id, scope);
    if (!row) throw AppError.notFound('Notification');
    return safeDetail(row);
  },

  async retry(params: {
    id: string;
    scope: NotificationOperationScope;
    actorId: string;
    reason: string;
  }) {
    return this.mutate({ ...params, action: 'retry' as const });
  },

  async cancel(params: {
    id: string;
    scope: NotificationOperationScope;
    actorId: string;
    reason: string;
  }) {
    return this.mutate({ ...params, action: 'cancel' as const });
  },

  async mutate(params: {
    id: string;
    scope: NotificationOperationScope;
    actorId: string;
    reason: string;
    action: 'retry' | 'cancel';
  }) {
    return withTransaction(async (client) => {
      const row = await notificationOperationsRepository.findByIdForUpdate(
        client,
        params.id,
        params.scope
      );
      if (!row) throw AppError.notFound('Notification');

      const state = capabilities(row);
      if (params.action === 'retry' && !state.canRetry) {
        throw AppError.conflict('Only retryable failed notifications can be retried manually');
      }
      if (params.action === 'cancel' && row.status === 'cancelled') return safeDetail(row);
      if (params.action === 'cancel' && !state.canCancel) {
        throw AppError.conflict(
          'Only pending notifications for terminal tickets can be cancelled manually'
        );
      }

      const updated =
        params.action === 'retry'
          ? await notificationOperationsRepository.retryFailed(client, row.id, params.reason)
          : await notificationOperationsRepository.cancelObsoletePending(
              client,
              row.id,
              params.reason
            );
      if (!updated) throw AppError.conflict('Notification state changed; refresh and try again');
      const completeRow = { ...row, ...updated };
      await notificationOperationsRepository.insertAudit(client, {
        actorId: params.actorId,
        action:
          params.action === 'retry' ? 'notification_manual_retry' : 'notification_manual_cancel',
        row: completeRow,
        fromStatus: row.status,
        reason: params.reason,
        failureCategory: state.failureCategory,
      });
      return safeDetail(completeRow);
    });
  },
};
