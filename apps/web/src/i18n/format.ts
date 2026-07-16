import type { SupportedLocale } from '@line-queue/shared';

const INTL_LOCALE: Record<SupportedLocale, string> = { ja: 'ja-JP', vi: 'vi-VN', en: 'en-US' };

export function toIntlLocale(locale: string): string {
  return INTL_LOCALE[(locale.split('-')[0] as SupportedLocale) ?? 'ja'] ?? INTL_LOCALE.ja;
}

export function formatDateTime(value: string | Date, locale: string, timeZone = 'Asia/Tokyo') {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(value);
}

export function formatCurrency(value: number, locale: string, currency = 'JPY') {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}
