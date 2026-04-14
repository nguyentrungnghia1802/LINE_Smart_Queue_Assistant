import type { Queue } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from './apiClient';

const BASE = `${API_BASE_PATH}/queues`;

export interface QueueListParams {
  page?: number;
  limit?: number;
}

export const queuesApi = {
  list: (params?: QueueListParams) => get<Queue[]>(BASE, { params }),

  getById: (id: string) => get<Queue>(`${BASE}/${id}`),

  create: (data: {
    orgId: string;
    name: string;
    description?: string;
    prefix?: string;
    maxCapacity?: number;
  }) => post<Queue>(BASE, data),

  update: (
    id: string,
    data: Partial<
      Pick<Queue, 'name' | 'description' | 'status' | 'maxCapacity' | 'avgServiceTimeMinutes'>
    >
  ) => patch<Queue>(`${BASE}/${id}`, data),

  updateStatus: (id: string, status: Queue['status']) =>
    patch<Queue>(`${BASE}/${id}/status`, { status }),

  delete: (id: string) => del(`${BASE}/${id}`),
};
