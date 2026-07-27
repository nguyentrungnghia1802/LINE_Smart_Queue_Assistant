import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { bookingPathFromQr } from '../qrBookingPath';
import { QrScannerButton } from '../QrScannerButton';

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice() {
      return Promise.resolve({ stop: vi.fn() });
    }
  },
}));

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
});
