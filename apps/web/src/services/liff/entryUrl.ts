const LIFF_URL_BASE = 'https://liff.line.me';
const DEFAULT_LIFF_ENDPOINT_PATH = '/liff';

export function sanitizeLiffRoute(route: string): string | null {
  const normalized = route.trim();
  if (!normalized.startsWith('/liff/') || normalized.startsWith('//')) return null;
  return normalized;
}

export function normalizeLiffEndpointPath(endpointPath?: string): string {
  const trimmed = endpointPath?.trim();
  if (trimmed === '/') return '';

  const normalized = trimmed?.replace(/\/+$/, '');
  if (!normalized) return DEFAULT_LIFF_ENDPOINT_PATH;
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return DEFAULT_LIFF_ENDPOINT_PATH;
  }
  return normalized;
}

export function toLiffAdditionalPath(route: string, endpointPath?: string): string | null {
  const normalizedRoute = sanitizeLiffRoute(route);
  if (!normalizedRoute) return null;

  const normalizedEndpointPath = normalizeLiffEndpointPath(endpointPath);
  if (!normalizedEndpointPath) return normalizedRoute;
  if (!normalizedRoute.startsWith(`${normalizedEndpointPath}/`)) return null;
  return normalizedRoute.slice(normalizedEndpointPath.length);
}

export function buildLiffEntryUrl(
  liffId: string | undefined,
  route: string,
  endpointPath = import.meta.env.VITE_LIFF_ENDPOINT_PATH
): string | null {
  const normalizedLiffId = liffId?.trim();
  const additionalPath = toLiffAdditionalPath(route, endpointPath);
  if (!normalizedLiffId || !additionalPath) return null;

  return `${LIFF_URL_BASE}/${normalizedLiffId}${additionalPath}`;
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
  if (import.meta.env.VITE_LIFF_MOCK === 'true') return normalizedRoute;

  return buildLiffEntryUrl(
    import.meta.env.VITE_LIFF_ID,
    normalizedRoute,
    import.meta.env.VITE_LIFF_ENDPOINT_PATH
  );
}
