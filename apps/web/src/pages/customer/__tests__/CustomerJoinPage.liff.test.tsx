import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import { i18n } from '../../../i18n';
import { ApiClientError, get, post } from '../../../services/apiClient';
import { getCustomerLineEntryUrl } from '../../../services/liff/entryUrl';
import { useAuthStore } from '../../../store/authStore';
import type { LiffContext } from '../../../types/liff';
import {
  BOOKING_GROUP_PREFIX,
  CHECKOUT_DRAFT_PREFIX,
  PAID_CHECKOUT_PREFIX,
  paymentKeyFor,
  savePaidCheckout,
} from '../../../utils/checkoutSession';
import { CustomerJoinPage, CustomerLineEntryPage, LiffCustomerJoinPage } from '../CustomerJoinPage';

vi.mock('../../../services/apiClient', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(
      readonly code: string,
      readonly status?: number,
      readonly details?: unknown,
      message?: string
    ) {
      super(message ?? code);
    }
  },
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../services/liff/entryUrl', () => ({
  getCustomerLineEntryUrl: vi.fn((route: string) => `https://liff.line.me/test-id?route=${route}`),
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
    friendshipStatus: 'friend',
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
    refreshFriendship: vi.fn().mockResolvedValue(true),
    requestFriendship: vi.fn().mockResolvedValue(true),
    scanQrCode: vi.fn().mockResolvedValue(null),
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
            <Route path="/liff/checkout/demo/:sessionId" element={<LocationProbe />} />
            <Route path="/liff/tickets/:entryId" element={<LocationProbe />} />
          </Routes>
        </LiffRuntimeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeOrgResponse({
  productName = 'カット',
  requiresPrepayment = false,
  isAcceptingBookings = true,
  branchOpen = isAcceptingBookings,
  queueStatus = isAcceptingBookings ? 'open' : 'closed',
}: {
  productName?: string;
  requiresPrepayment?: boolean;
  isAcceptingBookings?: boolean;
  branchOpen?: boolean;
  queueStatus?: 'open' | 'paused' | 'closed';
} = {}) {
  const product = {
    id: 'product-1',
    name: productName,
    description: null,
    image_url: null,
    price: '3000',
    service_time_minutes: 30,
    requires_prepayment: requiresPrepayment,
    stock_quantity: null,
    product_type: 'service',
  };
  const queue = {
    id: 'queue-1',
    name: '受付',
    description: null,
    prefix: 'A',
    status: queueStatus,
    isAcceptingBookings,
    isQueueOpen: queueStatus === 'open',
    isBranchOpen: branchOpen,
    waitingCount: 0,
    avgWaitMinutes: 5,
    products: [product],
  };
  return {
    org: {
      id: 'org-1',
      name: 'テスト店舗',
      slug: 'test-store',
      logoUrl: null,
      phone: null,
      address: 'Tokyo',
      paymentInfo: null,
    },
    branch: {
      id: 'branch-1',
      name: '東京店',
      phone: '03-1234-5678',
      email: 'tokyo@example.com',
      postalCode: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      addressLine1: '千代田1-1',
      addressLine2: null,
      isOpen: branchOpen,
    },
    queues: [queue],
    queue,
    products: [product],
  };
}

describe('LiffCustomerJoinPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getCustomerLineEntryUrl).mockImplementation(
      (route: string) => `https://liff.line.me/test-id?route=${route}`
    );
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.mocked(get).mockResolvedValue(makeOrgResponse());
    vi.mocked(post).mockResolvedValue({
      order: { id: 'order-1' },
      queueEntry: { id: 'entry-123' },
    });
  });

  it('creates a booking in the LIFF flow and redirects to the LIFF ticket view', async () => {
    const user = userEvent.setup();
    renderLiffBooking();

    await screen.findByRole('heading', { name: '東京店' });
    await user.click(screen.getByRole('button', { name: 'カット を追加' }));
    await user.type(screen.getByLabelText('お名前（必須）'), '山田太郎');
    await user.type(screen.getByLabelText('電話番号（必須）'), '0901234567');
    await user.click(await screen.findByRole('button', { name: '予約する' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/v1/orders',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      )
    );
    const payload = vi.mocked(post).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      orgSlug: 'test-store',
      branchId: 'branch-1',
      queueId: 'queue-1',
      customerName: '山田太郎',
      customerPhone: '0901234567',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
    expect(payload).not.toHaveProperty('lineUserId');
    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/tickets/entry-123');
  });

  it('shows only locally remembered bookings that are still active on the server', async () => {
    useAuthStore.setState({
      user: { id: 'customer-1', role: UserRole.CUSTOMER },
      token: 'customer-token',
      isAuthenticated: true,
    });
    localStorage.setItem(
      `${BOOKING_GROUP_PREFIX}liff:qr:demo-token`,
      JSON.stringify({
        id: 'group-1',
        orgSlug: 'test-store',
        localDeviceKey: 'device-1',
        updatedAt: new Date().toISOString(),
        records: [
          {
            orderId: 'order-active',
            queueEntryId: 'entry-active',
            ticketPath: '/liff/tickets/entry-active',
            createdAt: '2026-07-28T01:00:00.000Z',
            items: [],
            subtotal: 1000,
          },
          {
            orderId: 'order-completed',
            queueEntryId: 'entry-completed',
            ticketPath: '/liff/tickets/entry-completed',
            createdAt: '2026-07-27T01:00:00.000Z',
            items: [],
            subtotal: 2000,
          },
        ],
      })
    );
    vi.mocked(get).mockImplementation((url: string) => {
      if (url === '/api/v1/queue/me') {
        return Promise.resolve([{ entry: { id: 'entry-active' } }]);
      }
      return Promise.resolve(makeOrgResponse());
    });

    renderLiffBooking();

    expect(await screen.findByText(i18n.t('customer:booking.booked'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1,000/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2,000/ })).not.toBeInTheDocument();
    expect(screen.queryByText('ステップ 1')).not.toBeInTheDocument();
  });

  it('shows only the catalog assigned to the selected branch queue', async () => {
    const response = makeOrgResponse();
    vi.mocked(get).mockResolvedValue({
      ...response,
      queues: [
        response.queues[0],
        {
          ...response.queues[0],
          id: 'queue-2',
          name: 'カラー受付',
          waitingCount: 4,
          avgWaitMinutes: 20,
          products: [
            {
              ...response.products[0],
              id: 'product-2',
              name: 'ヘアカラー',
            },
          ],
        },
      ],
      queue: response.queues[0],
      products: response.products,
    });
    const user = userEvent.setup();

    renderLiffBooking();

    await screen.findByRole('heading', { name: '東京店' });
    expect(screen.queryByRole('button', { name: 'カット を追加' })).not.toBeInTheDocument();

    const queueSelect = screen.getByRole('combobox', { name: '受付キューを選択' });
    expect(screen.queryByRole('button', { name: /カラー受付/ })).not.toBeInTheDocument();
    await user.selectOptions(queueSelect, 'queue-2');

    expect(screen.getByRole('button', { name: 'ヘアカラー を追加' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'カット を追加' })).not.toBeInTheDocument();
    expect(screen.getByText('20分')).toBeInTheDocument();
  });

  it('clears the completed draft and used payment before a new booking attempt', async () => {
    vi.mocked(get).mockResolvedValue(
      makeOrgResponse({ productName: '前払いカット', requiresPrepayment: true })
    );
    const draftKey = 'liff:qr:demo-token';
    const paymentKey = paymentKeyFor('test-store:queue-1:product-1:1', 'required_items');
    sessionStorage.setItem(
      `${CHECKOUT_DRAFT_PREFIX}${draftKey}`,
      JSON.stringify({
        cart: { 'product-1': 1 },
        customerName: '以前の名前',
        customerPhone: '09000000000',
      })
    );
    savePaidCheckout(paymentKey, {
      paid: true,
      transactionId: 'payment-previous',
      method: 'demo',
      code: 'payment-previous',
      amount: 3000,
      scope: 'required_items',
      coveredProductIds: ['product-1'],
      cartSignature: 'product-1:1',
      paidAt: new Date().toISOString(),
      autoBookAfterPayment: true,
    });

    const firstRender = renderLiffBooking();
    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/tickets/entry-123');

    expect(sessionStorage.getItem(`${CHECKOUT_DRAFT_PREFIX}${draftKey}`)).toBeNull();
    expect(sessionStorage.getItem(`${PAID_CHECKOUT_PREFIX}${paymentKey}`)).toBeNull();
    expect(localStorage.getItem(`${BOOKING_GROUP_PREFIX}${draftKey}`)).not.toBeNull();

    firstRender.unmount();
    renderLiffBooking();

    await screen.findByRole('heading', { name: '東京店' });
    expect(screen.getByPlaceholderText('例: 山田太郎')).toHaveValue('');
    expect(screen.getByPlaceholderText('例: 0901234567')).toHaveValue('');
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled();
  });

  it('discards a legacy used payment and keeps the cart ready for repayment', async () => {
    vi.mocked(get).mockResolvedValue(
      makeOrgResponse({ productName: '前払いカット', requiresPrepayment: true })
    );
    const draftKey = 'liff:qr:demo-token';
    const paymentKey = paymentKeyFor('test-store:queue-1:product-1:1', 'required_items');
    sessionStorage.setItem(
      `${CHECKOUT_DRAFT_PREFIX}${draftKey}`,
      JSON.stringify({
        cart: { 'product-1': 1 },
        customerName: '山田太郎',
        customerPhone: '0901234567',
        selectedQueueId: 'queue-1',
      })
    );
    savePaidCheckout(paymentKey, {
      paid: true,
      transactionId: 'payment-already-used',
      method: 'demo',
      code: 'payment-already-used',
      amount: 3000,
      scope: 'required_items',
      coveredProductIds: ['product-1'],
      cartSignature: 'product-1:1',
      paidAt: new Date().toISOString(),
    });
    vi.mocked(post).mockRejectedValueOnce(
      new ApiClientError('PAYMENT_ALREADY_USED', 409, undefined)
    );

    const user = userEvent.setup();
    renderLiffBooking();
    await screen.findByRole('heading', { name: '東京店' });
    await user.click(await screen.findByRole('button', { name: '予約する' }));

    expect(
      await screen.findByText(i18n.t('common:errors.PAYMENT_ALREADY_USED'))
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(`${PAID_CHECKOUT_PREFIX}${paymentKey}`)).toBeNull();
    expect(screen.getByRole('button', { name: '支払いへ進んで予約する' })).toBeEnabled();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('uses one booking button and continues to payment when prepayment is required', async () => {
    vi.mocked(get).mockResolvedValue(
      makeOrgResponse({ productName: '前払いカット', requiresPrepayment: true })
    );
    const user = userEvent.setup();
    renderLiffBooking();

    await screen.findByRole('heading', { name: '東京店' });
    await user.click(screen.getByRole('button', { name: '前払いカット を追加' }));
    await user.type(screen.getByLabelText('お名前（必須）'), '山田太郎');
    await user.type(screen.getByLabelText('電話番号（必須）'), '0901234567');
    expect(screen.queryByRole('button', { name: '事前支払いへ進む' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '支払いへ進んで予約する' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/checkout/demo/');
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks booking until LINE authentication is complete', async () => {
    renderLiffBooking('authenticating');

    await screen.findByRole('heading', { name: '東京店' });
    expect(screen.getByText(i18n.t('customer:home.authenticating'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks payment and booking when the selected queue is paused', async () => {
    vi.mocked(get).mockResolvedValue(
      makeOrgResponse({
        productName: '前払いカット',
        requiresPrepayment: true,
        isAcceptingBookings: false,
      })
    );
    const user = userEvent.setup();
    renderLiffBooking();

    expect(await screen.findAllByText(i18n.t('customer:booking.queuePaused'))).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '前払いカット を追加' }));

    expect(
      screen.getByRole('button', { name: i18n.t('customer:booking.queuePaused') })
    ).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('explains that an open queue is unavailable because the branch is outside business hours', async () => {
    vi.mocked(get).mockResolvedValue(
      makeOrgResponse({
        isAcceptingBookings: false,
        branchOpen: false,
        queueStatus: 'open',
      })
    );

    renderLiffBooking();

    expect(await screen.findAllByText(i18n.t('customer:booking.branchClosed'))).not.toHaveLength(0);
    expect(
      screen.getByRole('button', { name: i18n.t('customer:booking.branchClosed') })
    ).toBeDisabled();
  });

  it('shows a setup state instead of reporting a runtime error when no queue exists', async () => {
    const response = makeOrgResponse();
    vi.mocked(get).mockResolvedValue({
      ...response,
      queues: [],
      queue: null,
      products: [],
    });

    renderLiffBooking();

    expect(
      await screen.findAllByText(i18n.t('customer:booking.noQueuesConfigured'))
    ).not.toHaveLength(0);
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

    await screen.findByRole('heading', { name: '東京店' });
    expect(screen.getByText('Smart Queue Assistant')).toBeInTheDocument();
    expect(container.querySelector('header img[src="/logo.svg"]')).toBeInTheDocument();
  });

  it('routes a local customer entry into the LIFF mock booking flow', async () => {
    vi.mocked(getCustomerLineEntryUrl).mockReturnValue('/liff/qr/demo-token');

    render(
      <MemoryRouter initialEntries={['/qr/demo-token']}>
        <Routes>
          <Route path="/qr/:token" element={<CustomerLineEntryPage />} />
          <Route path="/liff/qr/:token" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/qr/demo-token');
  });

  it('requires LINE customer entry without logging out a staff session', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: { id: 'staff-001', role: UserRole.STAFF },
      token: 'staff-token',
      isAuthenticated: true,
    });
    const queryClient = makeQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/qr/demo-token']}>
          <Routes>
            <Route path="/qr/:token" element={<CustomerLineEntryPage />} />
            <Route path="/staff" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole('heading', { name: 'お客様として受付を開始してください' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'LINEでお客様として受付を開始' })).toHaveAttribute(
      'href',
      'https://liff.line.me/test-id?route=/liff/qr/demo-token'
    );
    expect(useAuthStore.getState()).toMatchObject({
      token: 'staff-token',
      isAuthenticated: true,
      user: { id: 'staff-001', role: UserRole.STAFF },
    });

    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/staff');
    expect(useAuthStore.getState().token).toBe('staff-token');
  });
});
