import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { get } from '../../../services/apiClient';
import { AdminOperationsPage } from '../AdminOperationsPage';

vi.mock('../../../services/apiClient', () => ({ get: vi.fn() }));
const getMock = vi.mocked(get);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminOperationsPage />
    </QueryClientProvider>
  );
}

describe('AdminOperationsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ja');
    getMock.mockResolvedValue({
      status: 'healthy',
      checkedAt: '2026-08-11T00:00:00.000Z',
      environment: 'production',
      release: 'sha-123',
      uptimeSeconds: 120,
      components: {
        api: { status: 'healthy' },
        postgres: { status: 'healthy' },
        redis: { status: 'healthy' },
        worker: { status: 'healthy' },
        realtime: { status: 'healthy', activeConnections: 2 },
        line: { status: 'not_configured' },
        payment: { status: 'healthy', mode: 'demo', provider: 'demo' },
      },
      notifications: {
        status: 'healthy',
        pending: 0,
        retrying: 0,
        failed: 0,
        oldestPendingSeconds: 0,
      },
      indicators: {
        requestCount: 10,
        errorCount: 0,
        requestErrorRate: 0,
        requestLatencySeconds: 0.1,
        notificationDeliveryLatencySeconds: 0.2,
        postgresPool: { total: 2, idle: 1, waiting: 0 },
      },
    });
  });

  it('renders localized runtime, notification, and demo-provider states', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: '稼働状況' })).toBeInTheDocument();
    expect(screen.getByText('バックグラウンドワーカー')).toBeInTheDocument();
    expect(screen.getByText('通知配信')).toBeInTheDocument();
    expect(screen.getByText('demo / demo')).toBeInTheDocument();
  });

  it('renders a controlled error state', async () => {
    getMock.mockRejectedValueOnce(new Error('network'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('稼働状況を取得できませんでした。');
  });
});
