import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { notificationOperationsApi } from '../../services/notificationOperations.api';
import { useAuthStore } from '../../store/authStore';
import { NotificationOperationsPage } from '../NotificationOperationsPage';

vi.mock('../../services/notificationOperations.api', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../services/notificationOperations.api')>();
  return {
    ...original,
    notificationOperationsApi: {
      list: vi.fn(),
      detail: vi.fn(),
      retry: vi.fn(),
      cancel: vi.fn(),
    },
  };
});

const summary = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  organizationName: 'Queue Lab',
  branchId: '33333333-3333-4333-8333-333333333333',
  branchName: 'Tokyo',
  queueEntryId: '44444444-4444-4444-8444-444444444444',
  queueName: 'Reception',
  ticketCode: 'A019',
  ticketStatus: 'served',
  eventType: 'called',
  locale: 'ja' as const,
  status: 'failed' as const,
  attemptCount: 5,
  maxAttempts: 5,
  manualRetryCount: 0,
  failureCategory: 'provider_5xx' as const,
  canRetry: true,
  canCancel: false,
  lineRecipient: 'U1***7890',
  nextRetryAt: null,
  sentAt: null,
  createdAt: '2026-08-10T01:00:00.000Z',
  updatedAt: '2026-08-10T01:01:00.000Z',
};

describe('NotificationOperationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'branch-manager',
        role: UserRole.MANAGER,
        organizationId: 'org-1',
        branchIds: ['branch-1'],
      },
      isAuthenticated: true,
      isInitialized: true,
    });
    vi.mocked(notificationOperationsApi.list).mockResolvedValue({
      items: [summary],
      page: 1,
      limit: 20,
      total: 1,
    });
    vi.mocked(notificationOperationsApi.detail).mockResolvedValue({
      ...summary,
      eventKey: 'queue_entry:entry:called',
      dispatchStatus: 'dispatched',
      dispatchedAt: '2026-08-10T01:00:10.000Z',
      processingStartedAt: null,
      sanitizedLastError: 'provider 503',
      operatorNote: null,
    });
    vi.mocked(notificationOperationsApi.retry).mockResolvedValue({
      ...summary,
      status: 'pending',
      canRetry: false,
      eventKey: 'queue_entry:entry:called',
      dispatchStatus: 'pending',
      dispatchedAt: null,
      processingStartedAt: null,
      sanitizedLastError: null,
      operatorNote: 'Provider recovered',
    });
  });

  it('renders safe responsive list data, opens detail, and schedules a guarded retry', async () => {
    renderPage();
    expect(await screen.findByText('A019')).toBeInTheDocument();
    expect(screen.getByText('Tokyo')).toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('A019'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('provider 503')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('操作理由'), {
      target: { value: 'Provider recovered' },
    });
    fireEvent.click(screen.getByRole('button', { name: '再送を予約' }));
    await waitFor(() =>
      expect(notificationOperationsApi.retry).toHaveBeenCalledWith(summary.id, 'Provider recovered')
    );
    expect(await screen.findByText('再送を予約しました。')).toBeInTheDocument();
  });

  it('shows an explicit error state when the API fails', async () => {
    vi.mocked(notificationOperationsApi.list).mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByText('通知配信を読み込めませんでした。')).toBeInTheDocument();
  });

  it('does not show organizationId or branchId filter inputs', () => {
    renderPage();
    // These filters were removed — scope is derived server-side
    expect(screen.queryByPlaceholderText('UUID')).not.toBeInTheDocument();
  });

  it('hides cancel button for staff users', async () => {
    useAuthStore.setState({
      user: { id: 'staff-user', role: UserRole.STAFF },
      isAuthenticated: true,
      isInitialized: true,
    });
    vi.mocked(notificationOperationsApi.detail).mockResolvedValue({
      ...summary,
      canCancel: true,
      eventKey: 'queue_entry:entry:called',
      dispatchStatus: 'dispatched',
      dispatchedAt: null,
      processingStartedAt: null,
      sanitizedLastError: 'provider 503',
      operatorNote: null,
    });

    renderPage();
    expect(await screen.findByText('A019')).toBeInTheDocument();
    fireEvent.click(screen.getByText('A019'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Staff should see retry but NOT cancel
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '再送を予約' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'キャンセル' })).not.toBeInTheDocument();
  });

  it('triggers list refetch when refresh button is clicked', async () => {
    renderPage();
    expect(await screen.findByText('A019')).toBeInTheDocument();

    const refreshButton = screen.getByRole('button', { name: '更新' });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(notificationOperationsApi.list).toHaveBeenCalledTimes(2);
    });
  });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationOperationsPage />
    </QueryClientProvider>
  );
}
