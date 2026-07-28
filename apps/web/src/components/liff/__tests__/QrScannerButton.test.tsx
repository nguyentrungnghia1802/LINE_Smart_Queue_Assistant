import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { bookingPathFromQr } from '../qrBookingPath';
import { QrScannerButton } from '../QrScannerButton';

const scannerMock = vi.hoisted(() => ({
  callback: null as null | ((result: { getText(): string } | undefined) => void),
  constraints: null as MediaStreamConstraints | null,
  stop: vi.fn(),
}));

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints(
      constraints: MediaStreamConstraints,
      _video: HTMLVideoElement,
      callback: (result: { getText(): string } | undefined) => void
    ) {
      scannerMock.constraints = constraints;
      scannerMock.callback = callback;
      return Promise.resolve({ stop: scannerMock.stop });
    }
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe('bookingPathFromQr', () => {
  it.each([
    ['https://queue.example.com/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['https://queue.example.com/liff/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['https://liff.line.me/1234567890-AbCdEfGh/qr/store-token-2026', '/liff/qr/store-token-2026'],
    ['/qr/store-token-2026', '/liff/qr/store-token-2026'],
  ])('normalizes a supported reception URL', (value, expected) => {
    expect(bookingPathFromQr(value)).toBe(expected);
  });

  it.each([
    'https://example.com/admin',
    'https://example.com/qr/x',
    'not a QR URL',
    'javascript:alert(1)',
  ])('rejects an unsupported QR value', (value) => {
    expect(bookingPathFromQr(value)).toBeNull();
  });
});

describe('QrScannerButton', () => {
  it('renders the camera dialog in a body portal so fixed positioning is not clipped', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QrScannerButton />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: i18n.t('customer:scanner.open') }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveClass('fixed', 'inset-0', 'h-dvh');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('uses the rear camera and opens the booking route after decoding a valid QR', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/liff/home']}>
        <Routes>
          <Route path="/liff/home" element={<QrScannerButton />} />
          <Route path="/liff/qr/:token" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: i18n.t('customer:scanner.open') }));
    await waitFor(() => expect(scannerMock.callback).not.toBeNull());

    expect(scannerMock.constraints).toMatchObject({
      video: { facingMode: { ideal: 'environment' } },
    });
    act(() => {
      scannerMock.callback?.({
        getText: () => 'https://queue.example.com/qr/store-token-2026',
      });
    });

    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/qr/store-token-2026');
    expect(scannerMock.stop).toHaveBeenCalled();
  });
});
