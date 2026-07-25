const LIFF_URL_BASE = 'https://liff.line.me';
const DEFAULT_LIFF_ENDPOINT_PATH = '/liff';

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

export function buildLiffPermanentLink(
  liffId: string,
  appRoute: string,
  endpointPath?: string
): string | null {
  const normalizedLiffId = liffId.trim();
  const normalizedEndpointPath = normalizeLiffEndpointPath(endpointPath);
  if (!normalizedLiffId || !appRoute.startsWith('/liff/') || appRoute.startsWith('//')) {
    return null;
  }
  if (normalizedEndpointPath && !appRoute.startsWith(`${normalizedEndpointPath}/`)) {
    return null;
  }

  const additionalPath = normalizedEndpointPath
    ? appRoute.slice(normalizedEndpointPath.length)
    : appRoute;
  return `${LIFF_URL_BASE}/${normalizedLiffId}${additionalPath}`;
}
