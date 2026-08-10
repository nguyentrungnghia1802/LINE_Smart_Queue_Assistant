import { get, post } from './apiClient';

export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export type NotificationFailureCategory =
  | 'blocked_recipient'
  | 'invalid_recipient'
  | 'timeout'
  | 'rate_limited'
  | 'provider_4xx'
  | 'provider_5xx'
  | 'network'
  | 'unknown';

export interface NotificationOperationSummary {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  branchId: string | null;
  branchName: string | null;
  queueEntryId: string | null;
  queueName: string | null;
  ticketCode: string | null;
  ticketStatus: string | null;
  eventType: string;
  locale: 'ja' | 'vi' | 'en';
  status: NotificationDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  manualRetryCount: number;
  failureCategory: NotificationFailureCategory | null;
  canRetry: boolean;
  canCancel: boolean;
  lineRecipient: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationOperationDetail extends NotificationOperationSummary {
  eventKey: string;
  dispatchStatus: 'pending' | 'dispatching' | 'dispatched';
  dispatchedAt: string | null;
  processingStartedAt: string | null;
  sanitizedLastError: string | null;
  operatorNote: string | null;
}

export interface NotificationOperationList {
  items: NotificationOperationSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface NotificationOperationFilters {
  page: number;
  limit: number;
  status?: string;
  queueId?: string;
  eventType?: string;
  createdFrom?: string;
  createdTo?: string;
}

function queryString(filters: NotificationOperationFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

export const notificationOperationsApi = {
  list: (filters: NotificationOperationFilters) =>
    get<NotificationOperationList>(`/api/v1/notifications/operations?${queryString(filters)}`),
  detail: (id: string) =>
    get<NotificationOperationDetail>(`/api/v1/notifications/operations/${id}`),
  retry: (id: string, reason: string) =>
    post<NotificationOperationDetail>(`/api/v1/notifications/operations/${id}/retry`, {
      reason,
    }),
  cancel: (id: string, reason: string) =>
    post<NotificationOperationDetail>(`/api/v1/notifications/operations/${id}/cancel`, {
      reason,
    }),
};
