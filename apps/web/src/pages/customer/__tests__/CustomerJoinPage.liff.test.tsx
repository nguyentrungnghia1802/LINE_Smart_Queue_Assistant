import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import { i18n } from '../../../i18n';
import { get, post } from '../../../services/apiClient';
import type { LiffContext } from '../../../types/liff';
import { CustomerJoinPage, LiffCustomerJoinPage } from '../CustomerJoinPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeLiffContext(authStatus: LiffContext['authStatus'] = 'authenticated'): LiffContext {
  return {
    initStatus: 'ready',
    authStatus,
    isInitialized: true,
    isLoggedIn: true,
    isInClient: true,
    profile: { userId: 'U123', displayName: 'Taro' },
    accessToken: 'access-token',
    idToken: 'id-token',
    error: null,
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderLiffBooking(authStatus: LiffContext['authStatus'] = 'authenticated') {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/liff/qr/demo-token']}>
        <LiffRuntimeProvider value={makeLiffContext(authStatus)}>
          <Routes>
            <Route path="/liff/qr/:token" element={<LiffCustomerJoinPage />} />
            <Route path="/liff/tickets/:entryId" element={<LocationProbe />} />
          </Routes>
        </LiffRuntimeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LiffCustomerJoinPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue({
      org: {
        id: 'org-1',
        name: 'テスト店舗',
        slug: 'test-store',
        logoUrl: null,
        phone: null,
        address: 'Tokyo',
        paymentInfo: null,
      },
      queue: {
        id: 'queue-1',
        name: '受付',
        prefix: 'A',
        waitingCount: 0,
        avgWaitMinutes: 5,
      },
      products: [
        {
          id: 'product-1',
          name: 'カット',
          description: null,
          image_url: null,
          price: '3000',
          service_time_minutes: 30,
          requires_prepayment: false,
          stock_quantity: null,
          product_type: 'service',
        },
      ],
    });
    vi.mocked(post).mockResolvedValue({
      order: { id: 'order-1' },
      queueEntry: { id: 'entry-123' },
    });
  });

  it('creates a booking in the LIFF flow and redirects to the LIFF ticket view', async () => {
    const user = userEvent.setup();
    renderLiffBooking();

    await screen.findByRole('heading', { name: 'テスト店舗' });
    await user.click(screen.getByRole('button', { name: 'カット を追加' }));
    await user.click(screen.getByRole('button', { name: '予約する' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/orders', expect.any(Object)));
    const payload = vi.mocked(post).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      orgSlug: 'test-store',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
    expect(payload).not.toHaveProperty('lineUserId');
    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/tickets/entry-123');
  });

  it('blocks booking until LINE authentication is complete', async () => {
    renderLiffBooking('authenticating');

    await screen.findByRole('heading', { name: 'テスト店舗' });
    expect(screen.getByText(i18n.t('customer:home.authenticating'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the shared product logo in the customer booking navigation', async () => {
    const queryClient = makeQueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/qr/demo-token']}>
          <Routes>
            <Route path="/qr/:token" element={<CustomerJoinPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByRole('heading', { name: 'テスト店舗' });
    expect(screen.getByText('Smart Queue Assistant')).toBeInTheDocument();
    expect(container.querySelector('header img[src="/logo.svg"]')).toBeInTheDocument();
  });
});
