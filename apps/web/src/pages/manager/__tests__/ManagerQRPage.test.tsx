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
    `https://liff.line.me/liff-test?liff.state=${encodeURIComponent(route)}`,
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
      id: 'org-1',
      name: 'Queue Lab',
      slug: 'queue-lab',
      publicQrToken: 'store-token',
      joinUrl: 'https://queue.example.com/qr/store-token',
      phone: null,
      address: 'Tokyo',
    });
  });

  it('uses LIFF for the primary printable QR and keeps the public URL as fallback', async () => {
    renderPage();

    const expectedLiffUrl = 'https://liff.line.me/liff-test?liff.state=%2Fliff%2Fqr%2Fstore-token';
    expect(await screen.findByTestId('qr-value')).toHaveTextContent(expectedLiffUrl);
    expect(screen.getByText('LINE受付（推奨）')).toBeInTheDocument();
    expect(screen.getByText('https://queue.example.com/qr/store-token')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'お客様用リンクをコピー' }));
    await waitFor(() => expect(mockWriteText).toHaveBeenCalledWith(expectedLiffUrl));

    fireEvent.click(screen.getByRole('button', { name: '予備リンクをコピー' }));
    await waitFor(() =>
      expect(mockWriteText).toHaveBeenCalledWith('https://queue.example.com/qr/store-token')
    );
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
