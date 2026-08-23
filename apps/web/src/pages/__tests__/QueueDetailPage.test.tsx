import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { ApiClientError } from '../../services/apiClient';
import { QueueDetailPage } from '../QueueDetailPage';

const mockMutateAsync = vi.fn();
const mockUseQueue = vi.fn();

vi.mock('../../hooks/useQueues', () => ({
  useQueue: () => mockUseQueue(),
  useDeleteQueue: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

describe('QueueDetailPage deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueue.mockReturnValue({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'General reception',
        description: 'Main queue',
        status: 'open',
        currentNumber: 10,
        waitingCount: 0,
        calledCount: 0,
        servingCount: 0,
      },
      isLoading: false,
      isError: false,
    });
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it('confirms deletion and returns to the queue list after success', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('manager:queue.delete') }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/General reception/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('manager:queue.delete') }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333')
    );
    expect(await screen.findByText('Queue list destination')).toBeInTheDocument();
  });

  it('shows a localized conflict when active tickets or Staff still depend on the queue', async () => {
    mockMutateAsync.mockRejectedValue(new ApiClientError('CONFLICT', 409));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('manager:queue.delete') }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('manager:queue.delete') }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      i18n.t('manager:queue.deleteBlocked')
    );
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manager/queues/33333333-3333-4333-8333-333333333333']}>
      <Routes>
        <Route path="/manager/queues/:id" element={<QueueDetailPage />} />
        <Route path="/manager/queues" element={<p>Queue list destination</p>} />
      </Routes>
    </MemoryRouter>
  );
}
