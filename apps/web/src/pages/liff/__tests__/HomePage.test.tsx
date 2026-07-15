import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TicketStatus } from '@line-queue/shared';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import { get } from '../../../services/apiClient';
import type { LiffAuthStatus, LiffContext } from '../../../types/liff';
import type { TicketPositionResult } from '../../../types/queue-entry';
import { HomePage } from '../HomePage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function makeLiffContext(authStatus: LiffAuthStatus = 'authenticated'): LiffContext {
  const isAuthenticated = authStatus === 'authenticated';
  return {
    initStatus: 'ready',
    authStatus,
    isInitialized: true,
    isLoggedIn: isAuthenticated,
    isInClient: true,
    profile: isAuthenticated ? { userId: 'U123', displayName: 'Taro' } : null,
    accessToken: isAuthenticated ? 'access-token' : null,
    idToken: isAuthenticated ? 'id-token' : null,
    error: null,
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function makeTicket(id = 'entry-123'): TicketPositionResult {
  return {
    entry: {
      id,
      queue_id: 'queue-1',
      user_id: 'user-1',
      order_id: 'order-1',
      line_user_id: 'U123',
      ticket_number: 19,
      ticket_code: 'A019',
      status: TicketStatus.WAITING,
      priority: 0,
      position_snapshot: null,
      estimated_wait_seconds: null,
      called_at: null,
      serving_started_at: null,
      served_at: null,
      skipped_at: null,
      cancelled_at: null,
      no_show_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    aheadCount: 2,
    estimatedWaitSeconds: 900,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderHome({
  authStatus = 'authenticated',
  initialEntry = '/liff/home',
  tickets = [],
}: {
  authStatus?: LiffAuthStatus;
  initialEntry?: string;
  tickets?: TicketPositionResult[];
} = {}) {
  vi.mocked(get).mockImplementation((url: string) => {
    if (url === '/api/v1/queue/me') return Promise.resolve(tickets);
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LiffRuntimeProvider value={makeLiffContext(authStatus)}>
          <Routes>
            <Route path="/liff/home" element={<HomePage />} />
            <Route path="/liff/tickets" element={<LocationProbe />} />
            <Route path="/liff/tickets/:entryId" element={<LocationProbe />} />
            <Route path="/liff/qr/:token" element={<LocationProbe />} />
          </Routes>
        </LiffRuntimeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.mocked(get).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('waits for LINE authentication before loading tickets', () => {
    renderHome({ authStatus: 'authenticating' });

    expect(screen.getByText('LINE認証中です')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('shows the active ticket and opens the ticket view', async () => {
    renderHome({ tickets: [makeTicket()] });

    expect(await screen.findByText('A019')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /A019/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/liff/tickets/entry-123');
  });

  it('shows a Japanese empty state when there is no active ticket', async () => {
    renderHome();

    expect(await screen.findByText('有効な受付番号はありません')).toBeInTheDocument();
    expect(screen.getByText('予約する場合は「予約する」から店舗の受付ページへ進んでください。'));
  });

  it('starts booking from the configured LIFF booking path', async () => {
    vi.stubEnv('VITE_LIFF_DEFAULT_BOOKING_PATH', '/liff/qr/demo-queue-lab-2026');
    renderHome();

    await userEvent.click(screen.getByRole('button', { name: /予約する/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/liff/qr/demo-queue-lab-2026');
  });

  it('resolves the current ticket route from Rich Menu mode without a fixed entry ID', async () => {
    renderHome({ initialEntry: '/liff/home?mode=ticket', tickets: [makeTicket()] });

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/liff/tickets/entry-123')
    );
  });
});
