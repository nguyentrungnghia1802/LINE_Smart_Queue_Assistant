import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagerQRPage } from '../ManagerQRPage';

const { mockGet, mockWriteText } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockWriteText: vi.fn(),
}));

vi.mock('../../../services/apiClient', () => ({
  get: mockGet,
}));

vi.mock('../../../services/liff/entryUrl', () => ({
  buildLiffEntryUrl: (_liffId: string | undefined, route: string) =>
    `https://liff.line.me/liff-test${route.replace(/^\/liff/, '')}`,
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-value">{value}</div>,
}));

describe('ManagerQRPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockWriteText.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mockWriteText },
    });
    mockGet.mockResolvedValue({
      id: 'branch-1',
      name: 'Queue Lab',
      public_qr_token: 'store-token',
      phone: '03-1234-5678',
      postal_code: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      address_line1: '千代田1-1',
      address_line2: null,
    });
  });

  it('uses LIFF for the primary printable QR and keeps the public URL as fallback', async () => {
    renderPage();

    const expectedLiffUrl = 'https://liff.line.me/liff-test/qr/store-token';
    expect(await screen.findByTestId('qr-value')).toHaveTextContent(expectedLiffUrl);
    expect(screen.getByText('LINE受付（推奨）')).toBeInTheDocument();
    const expectedPublicUrl = `${window.location.origin}/qr/store-token`;
    expect(screen.getByText(expectedPublicUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'お客様用リンクをコピー' }));
    await waitFor(() => expect(mockWriteText).toHaveBeenCalledWith(expectedLiffUrl));

    fireEvent.click(screen.getByRole('button', { name: '予備リンクをコピー' }));
    await waitFor(() => expect(mockWriteText).toHaveBeenCalledWith(expectedPublicUrl));
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ManagerQRPage />
    </QueryClientProvider>
  );
}
