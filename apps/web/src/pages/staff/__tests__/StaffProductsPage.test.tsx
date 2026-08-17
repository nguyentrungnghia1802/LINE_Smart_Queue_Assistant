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
      {
        id: 'product-2',
        product_code: 'PRD-002-WITH-A-LONG-CODE',
        name: '非常に長い名前を持つレイアウト確認用の商品サービス',
        description: 'カードの固定領域を超える長い説明文です。詳細はダイアログで確認できます。',
        image_url: 'https://example.com/product.jpg',
        price: '123456789',
        service_time_minutes: 120,
        max_wait_minutes: null,
        requires_prepayment: false,
        stock_quantity: null,
      },
    ]);
  });

  it('keeps product images and long content inside fixed card regions', async () => {
    renderPage();

    const productName = await screen.findByText(
      '非常に長い名前を持つレイアウト確認用の商品サービス'
    );
    const productButton = productName.closest('button');
    if (!productButton) throw new Error('Expected the product name to be inside a button');

    expect(productButton).toHaveClass('flex', 'h-full', 'min-w-0', 'flex-col');
    expect(productName).toHaveClass('truncate');
    expect(productName).toHaveAttribute(
      'title',
      '非常に長い名前を持つレイアウト確認用の商品サービス'
    );

    const productImage = within(productButton).getByRole('img', {
      name: '非常に長い名前を持つレイアウト確認用の商品サービス',
    });
    expect(productImage).toHaveClass('h-full', 'w-full', 'object-cover', 'object-center');
    expect(productImage.parentElement).toHaveClass('aspect-square', 'overflow-hidden');

    expect(within(productButton).getByText('PRD-002-WITH-A-LONG-CODE')).toHaveClass('truncate');
    expect(within(productButton).getByText(/123,456,789/)).toHaveClass('truncate');
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
