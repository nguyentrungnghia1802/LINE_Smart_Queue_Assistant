import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatCurrency, formatDateTime, formatNumber } from '../format';
import { appResources, i18n, resolveAppLocale } from '../index';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix];
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (path.includes(`${resolve('src/i18n/locales')}`) || path.includes('__tests__')) return [];
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });
}

describe('frontend internationalization', () => {
  it('contains Japanese, Vietnamese, and English resources', async () => {
    await i18n.changeLanguage('vi');
    expect(i18n.t('actions.save', { ns: 'common' })).toBe('Lưu');
    await i18n.changeLanguage('en');
    expect(i18n.t('customer:booking.book')).toBe('Book');
    await i18n.changeLanguage('ja');
    expect(i18n.t('customer:booking.book')).toBe('予約する');
  });

  it('applies user, organization, client, then Japanese fallback', () => {
    expect(resolveAppLocale({ preferredLocale: 'vi', organizationLocale: 'en' })).toBe('vi');
    expect(resolveAppLocale({ organizationLocale: 'en', clientLocale: 'vi' })).toBe('en');
    expect(resolveAppLocale({ clientLocale: 'vi-VN' })).toBe('vi');
    expect(resolveAppLocale({ clientLocale: 'fr' })).toBe('ja');
  });

  it('formats dates, numbers, and JPY with Intl locale support', () => {
    expect(formatNumber(1234567, 'en')).toContain('1,234,567');
    expect(formatCurrency(4000, 'ja')).toContain('4,000');
    expect(formatDateTime('2026-07-16T03:00:00Z', 'en')).toContain('2026');
  });

  it('keeps translation keys aligned across all locales and domains', () => {
    for (const domain of Object.keys(appResources.ja) as Array<keyof typeof appResources.ja>) {
      const japaneseKeys = flattenKeys(appResources.ja[domain]).sort();
      expect(flattenKeys(appResources.vi[domain]).sort()).toEqual(japaneseKeys);
      expect(flattenKeys(appResources.en[domain]).sort()).toEqual(japaneseKeys);
    }
  });

  it('keeps Japanese UI copy inside locale resources', () => {
    const sourceRoot = resolve(process.cwd(), 'src');
    const violations = sourceFiles(sourceRoot).filter((file) =>
      /[ぁ-んァ-ン一-龯]/u.test(readFileSync(file, 'utf8'))
    );
    expect(violations).toEqual([]);
  });
});
