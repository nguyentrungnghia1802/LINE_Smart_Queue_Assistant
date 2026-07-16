import { localeFromAcceptLanguage, normalizeLocale, resolveLocale } from '../locale';

describe('locale resolution', () => {
  it('normalizes supported regional language tags', () => {
    expect(normalizeLocale('vi-VN')).toBe('vi');
    expect(normalizeLocale('en_US')).toBe('en');
    expect(normalizeLocale('fr-FR')).toBeNull();
  });

  it('uses Accept-Language quality ordering', () => {
    expect(localeFromAcceptLanguage('en-US;q=0.7, vi-VN;q=0.9, ja;q=0.8')).toBe('vi');
  });

  it('applies user, organization, client, then Japanese fallback', () => {
    expect(resolveLocale({ userLocale: 'en', organizationLocale: 'vi', clientLocale: 'ja' })).toBe(
      'en'
    );
    expect(resolveLocale({ organizationLocale: 'vi', clientLocale: 'en' })).toBe('vi');
    expect(resolveLocale({ clientLocale: 'en-US' })).toBe('en');
    expect(resolveLocale({ clientLocale: 'fr' })).toBe('ja');
  });
});
