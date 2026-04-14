import type { User } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, post } from './apiClient';

const BASE = `${API_BASE_PATH}/users`;

export const usersApi = {
  getById: (id: string) => get<User>(`${BASE}/${id}`),

  create: (data: { displayName: string; email?: string; role?: User['role'] }) =>
    post<User>(BASE, data),

  deactivate: (id: string) => del(`${BASE}/${id}`),
};
