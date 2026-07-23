const LIFF_URL_BASE = 'https://liff.line.me';

export function sanitizeLiffRoute(route: string): string | null {
  const normalized = route.trim();
  if (!normalized.startsWith('/liff/') || normalized.startsWith('//')) return null;
  return normalized;
}

export function buildLiffEntryUrl(liffId: string | undefined, route: string): string | null {
  const normalizedLiffId = liffId?.trim();
  const normalizedRoute = sanitizeLiffRoute(route);
  if (!normalizedLiffId || !normalizedRoute) return null;

  return `${LIFF_URL_BASE}/${normalizedLiffId}?liff.state=${encodeURIComponent(normalizedRoute)}`;
}

/**
 * Resolve a customer-facing LINE entry point.
 *
 * Production requires a real LIFF ID. Local development may use the mock
 * adapter and navigate directly to the same LIFF route without contacting LINE.
 */
export function getCustomerLineEntryUrl(route: string): string | null {
  const normalizedRoute = sanitizeLiffRoute(route);
  if (!normalizedRoute) return null;

  return (
    buildLiffEntryUrl(import.meta.env.VITE_LIFF_ID, normalizedRoute) ??
    (import.meta.env.VITE_LIFF_MOCK === 'true' ? normalizedRoute : null)
  );
}
