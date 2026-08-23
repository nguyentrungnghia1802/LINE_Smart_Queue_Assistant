import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { bookingPathFromQr } from '../qrBookingPath';
import { QrScannerButton } from '../QrScannerButton';

const scannerMock = vi.hoisted(() => ({
  onScan: null as null | ((codes: Array<{ format: string; rawValue: string }>) => void),
  onError: null as null | ((error: { kind: string; message: string }) => void),
  props: null as null | Record<string, unknown>,
}));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: Record<string, unknown>) => {
    scannerMock.props = props;
    scannerMock.onScan = props.onScan as typeof scannerMock.onScan;
    scannerMock.onError = props.onError as typeof scannerMock.onError;
    return <div data-testid="modern-qr-scanner" />;
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
  beforeEach(() => {
    scannerMock.onScan = null;
    scannerMock.onError = null;
    scannerMock.props = null;
  });

  it('uses the LIFF native scanner before the browser camera fallback', async () => {
    const user = userEvent.setup();
    const scanQrCode = vi.fn().mockResolvedValue('https://queue.example.com/qr/store-token-2026');
    render(
      <MemoryRouter initialEntries={['/liff/home']}>
        <Routes>
          <Route path="/liff/home" element={<QrScannerButton scanQrCode={scanQrCode} />} />
          <Route path="/liff/qr/:token" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: i18n.t('customer:scanner.open') }));

    expect(scanQrCode).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/qr/store-token-2026');
    expect(scannerMock.onScan).toBeNull();
  });

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
    await waitFor(() => expect(scannerMock.onScan).not.toBeNull());

    expect(scannerMock.props).toMatchObject({
      formats: ['qr_code'],
      constraints: { facingMode: { ideal: 'environment' } },
      allowMultiple: false,
    });
    act(() => {
      scannerMock.onScan?.([
        {
          format: 'qr_code',
          rawValue: 'https://queue.example.com/qr/store-token-2026',
        },
      ]);
    });

    expect(await screen.findByTestId('location')).toHaveTextContent('/liff/qr/store-token-2026');
    expect(screen.queryByTestId('modern-qr-scanner')).not.toBeInTheDocument();
  });

  it('keeps scanning after rejecting a non-booking QR value', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QrScannerButton />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: i18n.t('customer:scanner.open') }));
    await waitFor(() => expect(scannerMock.onScan).not.toBeNull());

    act(() => {
      scannerMock.onScan?.([{ format: 'qr_code', rawValue: 'https://example.com/admin' }]);
    });

    expect(screen.getByText(i18n.t('customer:scanner.invalidCode'))).toBeInTheDocument();
    expect(screen.getByTestId('modern-qr-scanner')).toBeInTheDocument();
  });
});
