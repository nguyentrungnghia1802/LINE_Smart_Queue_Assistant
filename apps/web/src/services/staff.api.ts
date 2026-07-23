import type { QueueEntryDisplay } from '../types';

import { get, post } from './apiClient';

const BASE = '/api/v1/staff';

// ── Response types ────────────────────────────────────────────────────────────

export interface QueueOverview {
  queueId: string;
  queueName: string;
  waitingEntries: QueueEntryDisplay[];
  calledEntry: QueueEntryDisplay | null;
  servingEntry: QueueEntryDisplay | null;
  waitingCount: number;
  totalActiveCount: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const staffApi = {
  /** GET /api/v1/staff/queues/:queueId — live staff board. */
  getQueueOverview: (queueId: string) => get<QueueOverview>(`${BASE}/queues/${queueId}`),

  /** POST /api/v1/staff/queues/:queueId/call-next — advance queue. */
  callNext: (queueId: string) =>
    post<{ entry: QueueEntryDisplay }>(`${BASE}/queues/${queueId}/call-next`),

  /** POST /api/v1/staff/entries/:entryId/serve — mark as serving. */
  serve: (entryId: string) =>
    post<{ entry: QueueEntryDisplay }>(`${BASE}/entries/${entryId}/serve`),

  /** POST /api/v1/staff/entries/:entryId/complete — mark as completed. */
  complete: (entryId: string) =>
    post<{ entry: QueueEntryDisplay }>(`${BASE}/entries/${entryId}/complete`),

  /** POST /api/v1/staff/entries/:entryId/no-show — mark as no-show. */
  noShow: (entryId: string) =>
    post<{ entry: QueueEntryDisplay }>(`${BASE}/entries/${entryId}/no-show`),

  /** POST /api/v1/staff/entries/:entryId/cancel — staff cancel. */
  cancel: (entryId: string) =>
    post<{ entry: QueueEntryDisplay }>(`${BASE}/entries/${entryId}/cancel`),
};
