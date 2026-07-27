import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../i18n';
import { ApiClientError } from '../../services/apiClient';
import { QueuesPage } from '../QueuesPage';

const mockUseQueues = vi.fn();

vi.mock('../../hooks/useQueues', () => ({
  useQueues: () => mockUseQueues(),
}));

describe('QueuesPage states', () => {
  beforeEach(() => {
    mockUseQueues.mockReset();
  });

  it('treats an empty queue list as a valid setup state', () => {
    mockUseQueues.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(i18n.t('manager:queue.listEmpty'))).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a retryable error state only when the API request failed', () => {
    mockUseQueues.mockReturnValue({
      data: undefined,
      error: new ApiClientError('INTERNAL_ERROR', 500, undefined, 'Database unavailable'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('manager:queue.listLoadFailed'));
    expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText(i18n.t('manager:queue.listEmpty'))).not.toBeInTheDocument();
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <QueuesPage />
    </MemoryRouter>
  );
}
