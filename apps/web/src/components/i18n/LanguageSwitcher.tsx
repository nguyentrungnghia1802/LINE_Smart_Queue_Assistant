import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type SupportedLocale } from '@line-queue/shared';

import { usersApi } from '../../services/users.api';
import { useAuthStore } from '../../store/authStore';

export function LanguageSwitcher({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { t, i18n } = useTranslation('common');
  const { user, setUser } = useAuthStore();
  const locale = (i18n.resolvedLanguage ?? 'ja') as SupportedLocale;

  async function changeLanguage(nextLocale: SupportedLocale) {
    await i18n.changeLanguage(nextLocale);
    if (!user) return;
    setUser({ ...user, preferredLocale: nextLocale });
    try {
      await usersApi.updateMe({ preferredLocale: nextLocale });
    } catch {
      // The local choice remains available if profile persistence is temporarily unavailable.
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
      {!compact && <span className="font-medium">{t('language.label')}</span>}
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => void changeLanguage(event.target.value as SupportedLocale)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {t(`language.${item}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
