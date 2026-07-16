import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@line-queue/shared';

export { DEFAULT_LOCALE, type SupportedLocale };

export function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(language) ? language : null;
}

export function localeFromAcceptLanguage(header: string | undefined): SupportedLocale | null {
  if (!header) return null;
  const candidates = header
    .split(',')
    .map((item) => {
      const [tag, ...parameters] = item.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      return { locale: normalizeLocale(tag), quality: quality ? Number(quality.slice(2)) : 1 };
    })
    .filter((item): item is { locale: SupportedLocale; quality: number } => item.locale !== null)
    .sort((a, b) => b.quality - a.quality);
  return candidates[0]?.locale ?? null;
}

export function resolveLocale(options: {
  userLocale?: unknown;
  organizationLocale?: unknown;
  clientLocale?: unknown;
}): SupportedLocale {
  return (
    normalizeLocale(options.userLocale) ??
    normalizeLocale(options.organizationLocale) ??
    normalizeLocale(options.clientLocale) ??
    DEFAULT_LOCALE
  );
}
