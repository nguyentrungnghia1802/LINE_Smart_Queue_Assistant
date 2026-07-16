import { API_BASE_PATH } from '@line-queue/shared';

import { apiClient } from './apiClient';

export interface BookingGroupOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
  created_at: string;
  ticket: null | {
    id: string;
    ticket_code: string;
    status: string;
    estimated_wait_seconds: number | null;
  };
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    subtotal: string;
    payment_status: string;
  }>;
}

export interface BookingGroup {
  id: string;
  organization_id: string;
  organization_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  orders: BookingGroupOrder[];
}

interface PaginatedBookingGroups {
  success: true;
  data: BookingGroup[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const bookingGroupsApi = {
  async listMine(page = 1, limit = 10) {
    const response = await apiClient.get<PaginatedBookingGroups>(
      `${API_BASE_PATH}/booking-groups/me`,
      { params: { page, limit } }
    );
    return { items: response.data.data, meta: response.data.meta };
  },
};
