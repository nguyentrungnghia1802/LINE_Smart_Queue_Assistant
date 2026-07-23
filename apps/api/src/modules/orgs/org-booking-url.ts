/**
 * Builds the browser fallback URL for an organization's public booking route.
 * LINE-first clients build a LIFF universal link separately from this URL.
 */
export function buildOrganizationBookingUrl(webOrigin: string, publicQrToken: string): string {
  const normalizedOrigin = webOrigin.replace(/\/+$/, '');
  return `${normalizedOrigin}/qr/${encodeURIComponent(publicQrToken)}`;
}
