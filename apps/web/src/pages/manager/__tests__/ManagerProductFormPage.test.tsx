import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { ApiClientError, post } from '../../../services/apiClient';
import { useAuthStore } from '../../../store/authStore';
import { ManagerProductFormPage } from '../ManagerProductFormPage';

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
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../services/media.api', () => ({ uploadImage: vi.fn() }));

describe('ManagerProductFormPage', () => {
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
  });

  it('shows a localized validation error code and affected image field', async () => {
    vi.mocked(post).mockRejectedValue(
      new ApiClientError('VALIDATION_ERROR', 422, {
        fieldErrors: { imageUrl: ['Invalid URL'] },
      })
    );

    renderPage();

    const form = screen.getByRole('button', { name: '保存' }).closest('form');
    if (!form) throw new Error('Product form was not rendered');
    fireEvent.submit(form);

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'エラーコード: VALIDATION_ERROR／対象: 商品画像'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '商品画像のURLが無効です。画像をもう一度アップロードしてください。'
    );
  });

  it('submits required prepayment and returns to the product list after creation', async () => {
    vi.mocked(post).mockResolvedValue({ id: 'product-id' });

    renderPage();

    fireEvent.click(screen.getByRole('checkbox', { name: '事前支払いを必須にする' }));
    const form = screen.getByRole('button', { name: '保存' }).closest('form');
    if (!form) throw new Error('Product form was not rendered');
    fireEvent.submit(form);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/v1/products',
        expect.objectContaining({
          requiresPrepayment: true,
        })
      )
    );
    expect(vi.mocked(post).mock.calls[0]?.[1]).not.toHaveProperty('isActive');
    expect(await screen.findByText('PRODUCT_LIST')).toBeInTheDocument();
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manager/products/new']}>
        <Routes>
          <Route path="/manager/products/new" element={<ManagerProductFormPage />} />
          <Route path="/manager/products" element={<div>PRODUCT_LIST</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
