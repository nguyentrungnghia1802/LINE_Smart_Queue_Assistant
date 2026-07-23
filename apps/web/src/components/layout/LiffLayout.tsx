import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { LiffRuntimeProvider } from '../../contexts/LiffRuntimeContext';
import { useLiff } from '../../hooks/useLiff';
import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';

const NAV_ITEMS = [
  { to: '/liff/home', labelKey: 'nav.home', icon: HomeIcon },
  { to: '/liff/tickets', labelKey: 'nav.tickets', icon: TicketsIcon },
  { to: '/liff/history', labelKey: 'nav.history', icon: HistoryIcon },
  { to: '/liff/preferences', labelKey: 'nav.settings', icon: SettingsIcon },
] as const;

/**
 * App shell for all LIFF customer-facing pages.
 *
 * Responsibilities:
 *   - Initialises the LIFF SDK once at mount (via useLiff)
 *   - Shows a full-screen loader while LIFF is initialising
 *   - Shows a full-screen error if LIFF init fails
 *   - Renders child routes (via <Outlet>) when ready
 *   - Provides a persistent bottom tab bar for primary navigation
 */
export function LiffLayout() {
  const { t } = useTranslation('common');
  const liff = useLiff();
  const { initStatus, error } = liff;

  const topHeader = (
    <header className="flex items-center gap-2 bg-line-green px-4 py-3 text-white shrink-0">
      <BrandLogo decorative className="h-9 w-9" />
      <span className="text-xl font-bold tracking-tight">
        {import.meta.env.VITE_APP_NAME ?? 'LINE Queue'}
      </span>
      <div className="ml-auto">
        <LanguageSwitcher compact />
      </div>
    </header>
  );

  if (initStatus === 'idle' || initStatus === 'loading') {
    return (
      <div className="min-h-dvh flex flex-col bg-white">
        {topHeader}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-gray-500">{t('states.loading')}</p>
        </div>
      </div>
    );
  }

  if (initStatus === 'error') {
    return (
      <div className="min-h-dvh flex flex-col bg-white">
        {topHeader}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <ErrorState
            title={t('errors.INTERNAL_ERROR')}
            message={error?.message ?? t('errors.UNKNOWN')}
          />
        </div>
      </div>
    );
  }

  return (
    <LiffRuntimeProvider value={liff}>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        {topHeader}

        {/* ── Page content (scrollable) ── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">
          <Outlet />
        </main>

        {/* ── Bottom tab bar ── */}
        <nav
          aria-label={t('accessibility.mainNavigation')}
          className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex items-stretch z-10 safe-bottom"
        >
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-line-green' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  <span>{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </LiffRuntimeProvider>
  );
}

// ── Inline SVG tab icons ──────────────────────────────────────────────────────

function HomeIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'fill-line-green' : 'fill-gray-400'}`}
      viewBox="0 0 24 24"
    >
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function TicketsIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'stroke-line-green' : 'stroke-gray-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  );
}

function HistoryIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'stroke-line-green' : 'stroke-gray-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 0 .5-4.5" />
      <polyline points="3 3 3 9 9 9" />
    </svg>
  );
}

function SettingsIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'stroke-line-green' : 'stroke-gray-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}
