import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@line-queue/shared';

import { admin as enAdmin } from './locales/en/admin';
import { auth as enAuth } from './locales/en/auth';
import { common as enCommon } from './locales/en/common';
import { customer as enCustomer } from './locales/en/customer';
import { manager as enManager } from './locales/en/manager';
import { staff as enStaff } from './locales/en/staff';
import { admin as jaAdmin } from './locales/ja/admin';
import { auth as jaAuth } from './locales/ja/auth';
import { common as jaCommon } from './locales/ja/common';
import { customer as jaCustomer } from './locales/ja/customer';
import { manager as jaManager } from './locales/ja/manager';
import { staff as jaStaff } from './locales/ja/staff';
import { admin as viAdmin } from './locales/vi/admin';
import { auth as viAuth } from './locales/vi/auth';
import { common as viCommon } from './locales/vi/common';
import { customer as viCustomer } from './locales/vi/customer';
import { manager as viManager } from './locales/vi/manager';
import { staff as viStaff } from './locales/vi/staff';

export const LOCALE_STORAGE_KEY = 'line-queue-locale';

function normalizeLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;
  const language = value.toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(language) ? language : null;
}

export function detectClientLocale(): SupportedLocale {
  const stored = normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;
  for (const language of navigator.languages ?? [navigator.language]) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function resolveAppLocale(options: {
  preferredLocale?: unknown;
  organizationLocale?: unknown;
  clientLocale?: unknown;
}): SupportedLocale {
  return (
    normalizeLocale(options.preferredLocale) ??
    normalizeLocale(options.organizationLocale) ??
    normalizeLocale(options.clientLocale) ??
    DEFAULT_LOCALE
  );
}

export const appResources = {
  ja: {
    common: jaCommon,
    auth: jaAuth,
    customer: jaCustomer,
    staff: jaStaff,
    manager: jaManager,
    admin: jaAdmin,
  },
  vi: {
    common: viCommon,
    auth: viAuth,
    customer: viCustomer,
    staff: viStaff,
    manager: viManager,
    admin: viAdmin,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    customer: enCustomer,
    staff: enStaff,
    manager: enManager,
    admin: enAdmin,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources: appResources,
  lng: detectClientLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common', 'auth', 'customer', 'staff', 'manager', 'admin'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (language) => {
  const locale = normalizeLocale(language) ?? DEFAULT_LOCALE;
  document.documentElement.lang = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
});
document.documentElement.lang = normalizeLocale(i18n.language) ?? DEFAULT_LOCALE;

export { i18n, normalizeLocale };
