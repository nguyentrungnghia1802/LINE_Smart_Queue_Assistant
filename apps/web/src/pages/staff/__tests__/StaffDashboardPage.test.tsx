import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get } from '../../../services/apiClient';
import { StaffDashboardPage } from '../StaffDashboardPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { organizationId: 'org-1', role: 'staff' },
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffDashboardPage />
    </QueryClientProvider>
  );
}

describe('StaffDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue({
      queueId: 'queue-1',
      queueName: '受付カウンターA',
      waitingCount: 1,
      waitingEntriesWithOrders: [
        {
          id: 'entry-1',
          ticket_code: 'A001',
          status: 'waiting',
          order: {
            id: 'order-1',
            booking_group_id: null,
            order_number: 'ORD-0001',
            customer_name: '山田 太郎',
            customer_phone: '09000000000',
            customer_email: 'customer@example.com',
            status: 'pending',
            subtotal: '3000',
            payment_status: 'unpaid',
            ticket_code: 'A001',
            queue_entry_status: 'waiting',
            created_at: new Date().toISOString(),
            items: [],
          },
        },
      ],
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
    });
  });

  it('shows the authenticated customer email in the selected order', async () => {
    renderPage();

    expect(await screen.findByText('customer@example.com')).toBeInTheDocument();
    expect(screen.getByText('メール')).toBeInTheDocument();
  });
});
