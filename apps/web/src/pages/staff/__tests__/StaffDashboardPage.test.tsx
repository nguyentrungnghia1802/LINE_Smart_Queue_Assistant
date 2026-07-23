import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get, post } from '../../../services/apiClient';
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
      totalActiveCount: 1,
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

  it('completes a serving ticket without sending a request body', async () => {
    vi.mocked(get).mockResolvedValue({
      queueId: 'queue-1',
      queueName: '受付カウンターA',
      waitingCount: 0,
      totalActiveCount: 1,
      waitingEntriesWithOrders: [],
      calledEntryWithOrder: null,
      servingEntryWithOrder: {
        id: '22222222-2222-4222-8222-222222222222',
        ticket_code: 'A004',
        status: 'serving',
        order: null,
      },
    });
    vi.mocked(post).mockResolvedValue({ entry: { id: 'entry-1', status: 'served' } });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '完了' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/v1/staff/entries/22222222-2222-4222-8222-222222222222/complete'
      )
    );
  });

  it('shows only the first eight active queue entries', async () => {
    vi.mocked(get).mockResolvedValue({
      queueId: 'queue-1',
      queueName: '受付カウンターA',
      waitingCount: 10,
      totalActiveCount: 10,
      waitingEntriesWithOrders: Array.from({ length: 10 }, (_, index) => ({
        id: `entry-${index + 1}`,
        ticket_code: `A${String(index + 1).padStart(3, '0')}`,
        status: 'waiting',
        order: null,
      })),
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
    });

    renderPage();

    expect(await screen.findAllByText('A001')).toHaveLength(2);
    expect(screen.getByText('A008')).toBeInTheDocument();
    expect(screen.queryByText('A009')).not.toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
