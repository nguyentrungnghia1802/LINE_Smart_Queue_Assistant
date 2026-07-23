import { buildOrganizationBookingUrl } from '../org-booking-url';

describe('buildOrganizationBookingUrl', () => {
  it('uses the configured public web origin instead of a local development URL', () => {
    expect(buildOrganizationBookingUrl('https://queue.example.jp/', 'store-token')).toBe(
      'https://queue.example.jp/qr/store-token'
    );
  });

  it('encodes the generated token as a URL path segment', () => {
    expect(buildOrganizationBookingUrl('https://queue.example.jp', 'store token')).toBe(
      'https://queue.example.jp/qr/store%20token'
    );
  });
});
