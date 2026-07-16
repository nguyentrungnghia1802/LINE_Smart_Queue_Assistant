import type { User } from '@line-queue/shared';
import type { SupportedLocale } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from './apiClient';

const BASE = `${API_BASE_PATH}/users`;

export const usersApi = {
  getById: (id: string) => get<User>(`${BASE}/${id}`),

  create: (data: { displayName: string; email?: string; role?: User['role'] }) =>
    post<User>(BASE, data),

  deactivate: (id: string) => del(`${BASE}/${id}`),
  updateMe: (data: { displayName?: string; email?: string; preferredLocale?: SupportedLocale }) =>
    patch<User>(`${BASE}/me`, data),
};
