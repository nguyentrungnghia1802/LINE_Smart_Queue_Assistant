import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { ApiClientError, del, get } from '../../../services/apiClient';
import { useAuthStore } from '../../../store/authStore';
import { ManagerProductsPage } from '../ManagerProductsPage';

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
  del: vi.fn(),
  get: vi.fn(),
}));

const product = {
  id: 'product-id',
  name: 'ヘアカット',
  description: null,
  image_url: null,
  price: '3500',
  service_time_minutes: 30,
  stock_quantity: null,
  product_type: 'service' as const,
  is_active: true,
};

describe('ManagerProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'manager-id',
        role: UserRole.MANAGER,
        organizationId: 'org-id',
      },
      token: 'token',
      isAuthenticated: true,
    });
    vi.mocked(get).mockResolvedValue([product]);
  });

  it('removes a successfully deleted product from the active list', async () => {
    vi.mocked(del).mockResolvedValue(undefined);
    vi.mocked(get).mockReset().mockResolvedValueOnce([product]).mockResolvedValue([]);
    renderPage();

    expect(await screen.findAllByText('ヘアカット')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/v1/products/product-id'));
    await waitFor(() => expect(screen.queryAllByText('ヘアカット')).toHaveLength(0));
  });

  it('shows a localized stable error code when deletion fails', async () => {
    vi.mocked(del).mockRejectedValue(new ApiClientError('INTERNAL_ERROR', 500));
    renderPage();

    await screen.findAllByText('ヘアカット');
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '商品を削除できませんでした。エラーコード: INTERNAL_ERROR'
    );
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ManagerProductsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
