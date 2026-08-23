import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { get } from '../../../services/apiClient';
import { queuesApi } from '../../../services/queues.api';
import { QueueSettingsPage } from '../QueueSettingsPage';

const ACTIVE_PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const STALE_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const QUEUE_ID = '33333333-3333-4333-8333-333333333333';
const queue = {
  id: QUEUE_ID,
  name: 'General reception',
  description: 'Main queue',
  status: 'open',
  maxCapacity: 20,
  avgServiceTimeMinutes: 15,
  absenceGraceMinutes: 5,
  productIds: [ACTIVE_PRODUCT_ID, STALE_PRODUCT_ID],
};

vi.mock('../../../hooks/useQueues', () => ({
  useQueue: () => ({
    data: queue,
    isLoading: false,
  }),
}));

vi.mock('../../../services/apiClient', () => ({ get: vi.fn() }));
vi.mock('../../../services/queues.api', () => ({
  queuesApi: { update: vi.fn() },
}));

describe('QueueSettingsPage product assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue([
      {
        id: ACTIVE_PRODUCT_ID,
        product_code: 'DV1',
        name: 'Active service',
        is_active: true,
      },
    ]);
    vi.mocked(queuesApi.update).mockResolvedValue({} as never);
  });

  it('removes stale product IDs before updating other queue settings', async () => {
    renderPage();

    expect(await screen.findByRole('checkbox', { name: /Active service/ })).toBeChecked();
    await waitFor(() =>
      expect(screen.getByText(i18n.t('manager:queue.productsSelected', { count: 1 }))).toBeVisible()
    );

    fireEvent.change(screen.getByDisplayValue('General reception'), {
      target: { value: 'Updated reception' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('manager:queue.saveSettings') }));

    await waitFor(() =>
      expect(queuesApi.update).toHaveBeenCalledWith(
        QUEUE_ID,
        expect.objectContaining({
          name: 'Updated reception',
          productIds: [ACTIVE_PRODUCT_ID],
        })
      )
    );
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manager/queues/${QUEUE_ID}/settings`]}>
        <Routes>
          <Route path="/manager/queues/:id/settings" element={<QueueSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
