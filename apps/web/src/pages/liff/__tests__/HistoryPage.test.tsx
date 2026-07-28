import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bookingGroupsApi } from '../../../services/bookingGroups.api';
import { HistoryPage } from '../HistoryPage';

vi.mock('../../../services/bookingGroups.api', () => ({
  bookingGroupsApi: { listMine: vi.fn() },
}));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/liff/history']}>
        <Routes>
          <Route path="/liff/history" element={<HistoryPage />} />
          <Route path="/liff/tickets/:entryId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HistoryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders server-side booking history and opens its independent ticket', async () => {
    vi.mocked(bookingGroupsApi.listMine).mockResolvedValue({
      items: [
        {
          id: 'group-1',
          organization_id: 'org-1',
          organization_name: '東京店',
          status: 'active',
          created_at: '2026-07-16T01:00:00.000Z',
          updated_at: '2026-07-16T01:00:00.000Z',
          orders: [
            {
              id: 'order-1',
              order_number: 'A100',
              branch_name_snapshot: '東京店',
              queue_name_snapshot: '受付A',
              status: 'pending',
              payment_status: 'paid',
              subtotal: '1200',
              created_at: '2026-07-16T01:00:00.000Z',
              ticket: {
                id: 'entry-1',
                ticket_code: 'A019',
                status: 'waiting',
                estimated_wait_seconds: 600,
              },
              items: [
                {
                  id: 'item-1',
                  product_name: 'ランチセット',
                  quantity: 1,
                  subtotal: '1200',
                  payment_status: 'paid',
                },
              ],
            },
          ],
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderHistory();

    expect(await screen.findByText('東京店')).toBeInTheDocument();
    expect(screen.queryByText('ランチセット × 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '注文 A100 の詳細を見る' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/liff/tickets/entry-1');
  });

  it('shows a Japanese empty state', async () => {
    vi.mocked(bookingGroupsApi.listMine).mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    renderHistory();
    expect(await screen.findByText('予約履歴はまだありません')).toBeInTheDocument();
  });
});
