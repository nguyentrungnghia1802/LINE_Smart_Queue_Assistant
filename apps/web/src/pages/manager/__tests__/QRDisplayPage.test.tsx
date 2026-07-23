import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { QRDisplayPage } from '../QRDisplayPage';

vi.mock('../../../services/apiClient', () => ({
  get: vi.fn(),
}));

vi.mock('../../../services/liff/entryUrl', () => ({
  getCustomerLineEntryUrl: (route: string) =>
    `https://liff.line.me/liff-test?liff.state=${encodeURIComponent(route)}`,
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-value">{value}</div>,
}));

describe('QRDisplayPage', () => {
  it('uses the LIFF customer route for the displayed queue QR code', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/queues/queue-1/display']}>
          <Routes>
            <Route path="/queues/:id/display" element={<QRDisplayPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('qr-value')).toHaveTextContent(
      'https://liff.line.me/liff-test?liff.state=%2Fliff%2Fjoin%2Fqueue-1'
    );
  });
});
