import type { Queue, QueueSummary } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from './apiClient';

const BASE = `${API_BASE_PATH}/queues`;

export interface QueueListParams {
  page?: number;
  limit?: number;
}

export const queuesApi = {
  list: (params?: QueueListParams) => get<QueueSummary[]>(BASE, { params }),

  getById: (id: string) => get<QueueSummary>(`${BASE}/${id}`),

  create: (data: {
    name: string;
    description?: string;
    prefix?: string;
    maxCapacity?: number;
    avgServiceTimeMinutes?: number;
    absenceGraceMinutes?: number;
    productIds?: string[];
  }) => post<QueueSummary>(BASE, data),

  update: (
    id: string,
    data: Partial<
      Pick<
        Queue,
        | 'name'
        | 'description'
        | 'status'
        | 'maxCapacity'
        | 'avgServiceTimeMinutes'
        | 'absenceGraceMinutes'
        | 'productIds'
      >
    >
  ) => patch<QueueSummary>(`${BASE}/${id}`, data),

  updateStatus: (id: string, status: Queue['status']) =>
    patch<QueueSummary>(`${BASE}/${id}/status`, { status }),

  delete: (id: string) => del(`${BASE}/${id}`),
};
