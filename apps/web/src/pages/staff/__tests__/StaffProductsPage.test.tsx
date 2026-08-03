import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get } from '../../../services/apiClient';
import { StaffProductsPage } from '../StaffProductsPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { organizationId: 'org-1', role: 'staff' },
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StaffProductsPage />
    </QueryClientProvider>
  );
}

describe('StaffProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue([
      {
        id: 'product-1',
        product_code: 'PRD-001',
        name: 'プレミアムサービス',
        description: '商品の詳しい説明です。',
        image_url: null,
        price: '3000',
        service_time_minutes: 30,
        max_wait_minutes: null,
        requires_prepayment: true,
        stock_quantity: 5,
      },
    ]);
  });

  it('opens product details and provides a prominent visible close control', async () => {
    renderPage();

    const productName = await screen.findByText('プレミアムサービス');
    const productButton = productName.closest('button');
    if (!productButton) throw new Error('Expected the product name to be inside a button');
    fireEvent.click(productButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'プレミアムサービス' })).toBeInTheDocument();
    expect(within(dialog).getByText('商品の詳しい説明です。')).toBeInTheDocument();

    const closeButton = within(dialog).getByRole('button', { name: '閉じる' });
    expect(closeButton).toHaveTextContent('閉じる');
    expect(closeButton).toHaveClass('min-h-11', 'bg-gray-950', 'text-white', 'shadow-lg');

    fireEvent.click(closeButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
