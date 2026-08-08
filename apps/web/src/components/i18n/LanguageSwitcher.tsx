import { ChevronDown, Languages } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type SupportedLocale } from '@line-queue/shared';

import { usersApi } from '../../services/users.api';
import { useAuthStore } from '../../store/authStore';

export function LanguageSwitcher({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { t, i18n } = useTranslation('common');
  const { user, setUser } = useAuthStore();
  const locale = (i18n.resolvedLanguage ?? 'ja') as SupportedLocale;
  const selectId = useId();

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
    <label
      htmlFor={selectId}
      className="inline-flex min-w-0 items-center gap-2 text-sm text-gray-600"
    >
      {!compact && <span className="font-medium">{t('language.label')}</span>}
      <span className="relative inline-flex min-w-0 items-center">
        <Languages
          className="pointer-events-none absolute left-2.5 h-4 w-4 text-brand-700"
          aria-hidden="true"
        />
        <select
          id={selectId}
          name="preferredLocale"
          aria-label={t('language.label')}
          value={locale}
          onChange={(event) => void changeLanguage(event.target.value as SupportedLocale)}
          className={`h-9 appearance-none rounded-lg border border-gray-300 bg-white py-0 pl-8 pr-8 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
            compact ? 'w-[7.75rem] sm:w-[8.5rem]' : 'min-w-40'
          }`}
        >
          {SUPPORTED_LOCALES.map((item) => (
            <option key={item} value={item}>
              {t(`language.${item}`)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 h-4 w-4 text-gray-400"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}
