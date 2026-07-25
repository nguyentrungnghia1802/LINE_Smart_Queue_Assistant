export function normalizeLiffState(value: string | null): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith('//')) return null;
  const endpointPath = (import.meta.env.VITE_LIFF_ENDPOINT_PATH || '/liff').replace(/\/+$/, '');
  const relativePath = decoded.startsWith(`${endpointPath}/`)
    ? decoded.slice(endpointPath.length)
    : decoded;
  if (
    !/^\/(?:home(?:[/?#]|$)|q\/|qr\/|join\/|tickets(?:[/?#]|$)|history(?:[/?#]|$)|preferences(?:[/?#]|$)|checkout\/demo\/)/.test(
      relativePath
    )
  ) {
    return null;
  }
  return `${endpointPath}${relativePath}`;
}
