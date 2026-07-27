export function bookingPathFromQr(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed, window.location.origin);
    const match = url.pathname.match(/\/(?:liff\/)?qr\/([A-Za-z0-9_-]{8,128})\/?$/);
    return match?.[1] ? `/liff/qr/${match[1]}` : null;
  } catch {
    return null;
  }
}
