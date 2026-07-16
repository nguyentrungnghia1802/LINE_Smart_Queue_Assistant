import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { detectClientLocale, resolveAppLocale } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

export function LocaleSync() {
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const locale = resolveAppLocale({
      preferredLocale: user?.preferredLocale,
      organizationLocale: user?.organizationLocale,
      clientLocale: detectClientLocale(),
    });
    if (i18n.resolvedLanguage !== locale) void i18n.changeLanguage(locale);
  }, [i18n, user?.organizationLocale, user?.preferredLocale]);

  return null;
}
