import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffQueuePage } from '../StaffQueuePage';

const mockUseStaffQueueOverview = vi.fn();
const mutation = { isPending: false, mutate: vi.fn() };

vi.mock('../../hooks/useStaffQueue', () => ({
  useStaffQueueOverview: (queueId: string) => mockUseStaffQueueOverview(queueId),
  useCallNext: () => mutation,
  useServeEntry: () => mutation,
  useCompleteEntry: () => mutation,
  useNoShowEntry: () => mutation,
  useCancelEntry: () => mutation,
}));

describe('StaffQueuePage manager route', () => {
  beforeEach(() => {
    mockUseStaffQueueOverview.mockReset();
    mockUseStaffQueueOverview.mockReturnValue({
      data: {
        queueId: 'queue-123',
        queueName: 'General reception',
        waitingEntries: [],
        calledEntry: null,
        servingEntry: null,
        waitingCount: 0,
        totalActiveCount: 0,
      },
      isError: false,
      isLoading: false,
    });
  });

  it('loads the queue using the :id route parameter', () => {
    render(
      <MemoryRouter initialEntries={['/manager/queues/queue-123/manage']}>
        <Routes>
          <Route path="/manager/queues/:id/manage" element={<StaffQueuePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockUseStaffQueueOverview).toHaveBeenCalledWith('queue-123');
    expect(screen.getByRole('heading', { name: 'General reception' })).toBeInTheDocument();
  });
});
