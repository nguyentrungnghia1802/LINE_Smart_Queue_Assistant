import { API_BASE_PATH } from '@line-queue/shared';

import type {
  JoinQueueInput,
  JoinQueueResult,
  QueueStatusResult,
  TicketPositionResult,
  TicketStatusResult,
} from '../types';

import { get, post } from './apiClient';

const BASE = `${API_BASE_PATH}/queue`;

/**
 * Customer-facing queue entry operations.
 * Mirrors the 4 MVP endpoints from apps/api (Prompt 12).
 */
export const queueEntryApi = {
  /**
   * Join a queue.
   * Returns 201 for a new ticket, 200 if the caller already has an active ticket.
   */
  join: (data: JoinQueueInput) => post<JoinQueueResult>(`${BASE}/join`, data),

  /**
   * Get all active tickets held by the current caller across all queues.
   * Anonymous callers (no auth token) receive an empty array.
   */
  myTickets: () => get<TicketPositionResult[]>(`${BASE}/me`),

  /**
   * Get live status for one ticket by queue entry ID.
   * Public endpoint; LIFF deep links use it after LINE auth has initialized.
   */
  getEntry: (entryId: string) => get<TicketStatusResult>(`${BASE}/entry/${entryId}`),

  /**
   * Get live status of a specific queue by path param.
   * Public — no authentication required.
   */
  getStatus: (queueId: string) => get<QueueStatusResult>(`${BASE}/${queueId}/status`),

  /**
   * Get live status of a specific queue by query param.
   * Equivalent to getStatus — used for QR-code / shareable links.
   * Public — no authentication required.
   */
  getCurrent: (queueId: string) =>
    get<QueueStatusResult>(`${BASE}/current`, { params: { queueId } }),
};
