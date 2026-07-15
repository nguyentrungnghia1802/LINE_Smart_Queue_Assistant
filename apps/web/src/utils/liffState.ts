export function normalizeLiffState(value: string | null): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/liff/') || decoded.startsWith('//')) return null;
  return decoded;
}
