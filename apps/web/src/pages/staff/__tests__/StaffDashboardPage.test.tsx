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
            customer_line_display_name: 'LINE 山田',
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

  it('shows the LINE display name in the selected order', async () => {
    renderPage();

    expect(await screen.findByText('LINE 山田')).toBeInTheDocument();
    expect(screen.getByText('LINE表示名')).toBeInTheDocument();
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
            customer_line_display_name: 'LINE 山田',
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

  it('subtracts prepaid item amounts from the amount still due', async () => {
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
            customer_line_display_name: 'LINE 山田',
            status: 'pending',
            subtotal: '5000',
            payment_status: 'partially_paid',
            ticket_code: 'A001',
            queue_entry_status: 'waiting',
            created_at: new Date().toISOString(),
            items: [
              {
                id: 'item-prepaid',
                product_name: '予約サービス',
                product_price: '1500',
                service_time_minutes: 30,
                quantity: 1,
                subtotal: '1500',
                payment_status: 'paid',
                prepaid_amount: '1500',
                refunded_amount: '0',
                requires_prepayment_snapshot: true,
              },
              {
                id: 'item-unpaid',
                product_name: '追加商品',
                product_price: '3500',
                service_time_minutes: 10,
                quantity: 1,
                subtotal: '3500',
                payment_status: 'unpaid',
                prepaid_amount: '0',
                refunded_amount: '0',
                requires_prepayment_snapshot: false,
              },
            ],
          },
        },
      ],
      calledEntryWithOrder: null,
      servingEntryWithOrder: null,
    });

    renderPage();

    expect(await screen.findAllByText('事前支払い済み')).not.toHaveLength(0);
    expect(screen.getAllByText(/1,500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('お支払い').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3,500/).length).toBeGreaterThan(0);
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

  it('keeps the completed receipt in a modal until staff confirms moving on', async () => {
    const completedOrder = {
      id: 'order-1',
      booking_group_id: null,
      order_number: 'ORD-0001',
      customer_name: '山田 太郎',
      customer_phone: '09000000000',
      customer_line_display_name: 'LINE 山田',
      organization_name_snapshot: 'スマート受付株式会社',
      branch_name_snapshot: '東京店',
      queue_name_snapshot: '受付カウンターA',
      fulfilled_by_name: '担当スタッフ',
      fulfilled_by_employee_code: 'ST-001',
      fulfilled_at: new Date().toISOString(),
      status: 'completed',
      subtotal: '3000',
      payment_status: 'paid',
      ticket_code: 'A004',
      queue_entry_status: 'served',
      created_at: new Date().toISOString(),
      items: [],
    };
    const queueOverview = {
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
        order: { ...completedOrder, status: 'processing', fulfilled_at: null },
      },
    };
    vi.mocked(get).mockImplementation(async (url) =>
      String(url).endsWith('/receipt') ? completedOrder : queueOverview
    );
    vi.mocked(post).mockResolvedValue({ entry: { id: 'entry-1', status: 'served' } });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '完了' }));

    expect(await screen.findByText('完了した受付の領収書を印刷できます。')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/orders/order-1/receipt');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '領収書を印刷' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '完了して次へ' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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
    fireEvent.click(await screen.findByRole('button', { name: '3枠後ろへ移動' }));

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
            customer_line_display_name: 'LINE 山田',
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
