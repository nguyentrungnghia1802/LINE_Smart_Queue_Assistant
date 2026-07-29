export interface AddressParts {
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
}

export function formatAddress(parts: AddressParts, locale = 'ja'): string {
  const locality = [parts.prefecture, parts.city, parts.addressLine1, parts.addressLine2]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(locale.startsWith('ja') ? '' : ', ');
  const postalCode = parts.postalCode?.trim();
  if (!postalCode) return locality;
  return locale.startsWith('ja')
    ? `〒${postalCode} ${locality}`
    : [postalCode, locality].filter(Boolean).join(', ');
}
