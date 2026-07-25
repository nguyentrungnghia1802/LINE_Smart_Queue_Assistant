import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get, patch, post } from '../../../services/apiClient';
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
    expect(screen.queryByRole('button', { name: '次の番号を呼び出す' })).not.toBeInTheDocument();
  });

  it('disables manual payment confirmation when the order is already paid', async () => {
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
            payment_status: 'paid',
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

    renderPage();

    const paidButton = await screen.findByRole('button', { name: '支払い済み' });
    expect(paidButton).toBeDisabled();
    fireEvent.click(paidButton);
    expect(patch).not.toHaveBeenCalled();
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

  it('lets staff move a called customer behind the current waiting queue', async () => {
    vi.mocked(get).mockResolvedValue({
      queueId: 'queue-1',
      queueName: '受付カウンターA',
      waitingCount: 1,
      totalActiveCount: 2,
      waitingEntriesWithOrders: [
        {
          id: 'entry-waiting',
          ticket_code: 'A002',
          status: 'waiting',
          order: null,
        },
      ],
      calledEntryWithOrder: {
        id: '22222222-2222-4222-8222-222222222222',
        ticket_code: 'A001',
        status: 'called',
        order: null,
      },
      servingEntryWithOrder: null,
    });
    vi.mocked(post).mockResolvedValue({ entry: { id: 'entry-1', status: 'waiting' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '順番を後ろに回す' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/v1/staff/entries/22222222-2222-4222-8222-222222222222/defer'
      )
    );
  });

  it('shows only active orders from the related booking group', async () => {
    const queueResponse = {
      queueId: 'queue-1',
      queueName: '受付カウンターA',
      waitingCount: 1,
      totalActiveCount: 1,
      waitingEntriesWithOrders: [
        {
          id: 'entry-1',
          ticket_code: 'A005',
          status: 'waiting',
          order: {
            id: 'order-active',
            booking_group_id: 'group-1',
            order_number: 'ORD-0005',
            customer_name: '山田 太郎',
            customer_phone: '09000000000',
            customer_email: 'customer@example.com',
            status: 'pending',
            subtotal: '3000',
            payment_status: 'unpaid',
            ticket_code: 'A005',
            queue_entry_status: 'waiting',
            created_at: new Date().toISOString(),
            items: [],
          },
        },
      ],
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
    };
    vi.mocked(get).mockImplementation(async (url: string) => {
      if (url === '/api/v1/staff/my-queue') return queueResponse;
      return {
        id: 'group-1',
        organization_id: 'org-1',
        organization_name: 'Test',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        orders: [
          {
            id: 'order-active',
            order_number: 'ORD-0005',
            status: 'pending',
            payment_status: 'unpaid',
            subtotal: '3000',
            created_at: new Date().toISOString(),
            ticket: {
              id: 'entry-1',
              ticket_code: 'A005',
              status: 'waiting',
              estimated_wait_seconds: 60,
            },
            items: [],
          },
          {
            id: 'order-completed',
            order_number: 'ORD-0001',
            status: 'completed',
            payment_status: 'paid',
            subtotal: '1000',
            created_at: new Date().toISOString(),
            ticket: {
              id: 'entry-old',
              ticket_code: 'A001',
              status: 'served',
              estimated_wait_seconds: 0,
            },
            items: [],
          },
        ],
      };
    });

    renderPage();

    expect(await screen.findByText('ORD-0005 · 処理待ち')).toBeInTheDocument();
    expect(screen.queryByText(/ORD-0001/)).not.toBeInTheDocument();
    expect(screen.getByText('1件の予約')).toBeInTheDocument();
  });
});
