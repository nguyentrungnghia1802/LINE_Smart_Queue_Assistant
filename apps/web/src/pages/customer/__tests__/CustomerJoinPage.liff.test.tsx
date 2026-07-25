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
            <Route path="/liff/checkout/demo/:sessionId" element={<LocationProbe />} />
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
    vi.mocked(getCustomerLineEntryUrl).mockImplementation(
      (route: string) => `https://liff.line.me/test-id?route=${route}`
    );
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
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
    await user.type(screen.getByLabelText('お名前（必須）'), '山田太郎');
    await user.type(screen.getByLabelText('電話番号（必須）'), '0901234567');
    await user.click(screen.getByRole('button', { name: '予約する' }));

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
      customerName: '山田太郎',
      customerPhone: '0901234567',
      items: [{ productId: 'product-1', quantity: 1 }],
    });
    expect(payload).not.toHaveProperty('lineUserId');
    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/tickets/entry-123');
  });

  it('clears the completed draft and used payment before a new booking attempt', async () => {
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
          name: '前払いカット',
          description: null,
          image_url: null,
          price: '3000',
          service_time_minutes: 30,
          requires_prepayment: true,
          stock_quantity: null,
          product_type: 'service',
        },
      ],
    });
    const draftKey = 'liff:qr:demo-token';
    const paymentKey = paymentKeyFor('test-store:product-1:1', 'required_items');
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

    await screen.findByRole('heading', { name: 'テスト店舗' });
    expect(screen.getByPlaceholderText('例: 山田太郎')).toHaveValue('');
    expect(screen.getByPlaceholderText('例: 0901234567')).toHaveValue('');
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled();
  });

  it('discards a legacy used payment and keeps the cart ready for repayment', async () => {
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
          name: '前払いカット',
          description: null,
          image_url: null,
          price: '3000',
          service_time_minutes: 30,
          requires_prepayment: true,
          stock_quantity: null,
          product_type: 'service',
        },
      ],
    });
    const draftKey = 'liff:qr:demo-token';
    const paymentKey = paymentKeyFor('test-store:product-1:1', 'required_items');
    sessionStorage.setItem(
      `${CHECKOUT_DRAFT_PREFIX}${draftKey}`,
      JSON.stringify({
        cart: { 'product-1': 1 },
        customerName: '山田太郎',
        customerPhone: '0901234567',
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
    await screen.findByRole('heading', { name: 'テスト店舗' });
    await user.click(screen.getByRole('button', { name: '予約する' }));

    expect(
      await screen.findByText(i18n.t('common:errors.PAYMENT_ALREADY_USED'))
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(`${PAID_CHECKOUT_PREFIX}${paymentKey}`)).toBeNull();
    expect(screen.getByRole('button', { name: '支払いへ進んで予約する' })).toBeEnabled();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('uses one booking button and continues to payment when prepayment is required', async () => {
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
          name: '前払いカット',
          description: null,
          image_url: null,
          price: '3000',
          service_time_minutes: 30,
          requires_prepayment: true,
          stock_quantity: null,
          product_type: 'service',
        },
      ],
    });
    const user = userEvent.setup();
    renderLiffBooking();

    await screen.findByRole('heading', { name: 'テスト店舗' });
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

    await screen.findByRole('heading', { name: 'テスト店舗' });
    expect(screen.getByText(i18n.t('customer:home.authenticating'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks payment and booking when no queue is accepting customers', async () => {
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
      queue: null,
      products: [
        {
          id: 'product-1',
          name: '前払いカット',
          description: null,
          image_url: null,
          price: '3000',
          service_time_minutes: 30,
          requires_prepayment: true,
          stock_quantity: null,
          product_type: 'service',
        },
      ],
    });
    const user = userEvent.setup();
    renderLiffBooking();

    expect(await screen.findAllByText(i18n.t('customer:booking.queueClosed'))).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '前払いカット を追加' }));

    expect(
      screen.getByRole('button', { name: i18n.t('customer:booking.queueClosed') })
    ).toBeDisabled();
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
