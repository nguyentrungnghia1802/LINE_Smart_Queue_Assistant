import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import { get } from '../../../services/apiClient';
import type { LiffContext } from '../../../types/liff';
import { TicketStatusPage } from '../TicketStatusPage';

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

function makeLiffContext(): LiffContext {
  return {
    initStatus: 'ready',
    authStatus: 'authenticated',
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

describe('TicketStatusPage', () => {
  beforeEach(() => {
    vi.mocked(get).mockImplementation((url: string) => {
      if (url === '/api/v1/queue/me') return Promise.resolve([]);
      if (url === '/api/v1/queue/entry/entry-123') {
        return Promise.resolve({
          entry: {
            id: 'entry-123',
            queue_id: 'queue-1',
            user_id: 'user-1',
            order_id: 'order-1',
            line_user_id: 'U123',
            ticket_number: 19,
            ticket_code: 'A019',
            status: 'waiting',
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
          order: null,
          aheadCount: 2,
          estimatedWaitSeconds: 900,
          queueName: '受付',
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
  });

  it('renders ticket status from a LIFF deep link entry ID', async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter initialEntries={['/liff/tickets/entry-123']}>
          <LiffRuntimeProvider value={makeLiffContext()}>
            <Routes>
              <Route path="/liff/tickets/:entryId" element={<TicketStatusPage />} />
            </Routes>
          </LiffRuntimeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('A019')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('約15分')).toBeInTheDocument();
  });
});
