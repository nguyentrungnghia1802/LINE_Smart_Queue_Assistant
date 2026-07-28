import { History, Home, Settings, TicketCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { LiffRuntimeProvider } from '../../contexts/LiffRuntimeContext';
import { useLiff } from '../../hooks/useLiff';
import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { LineFriendshipPrompt } from '../liff/LineFriendshipPrompt';
import { QrScannerButton } from '../liff/QrScannerButton';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';

const NAV_ITEMS = [
  { to: '/liff/home', labelKey: 'nav.home', icon: Home },
  { to: '/liff/tickets', labelKey: 'nav.tickets', icon: TicketCheck },
  { to: '/liff/history', labelKey: 'nav.history', icon: History },
  { to: '/liff/preferences', labelKey: 'nav.settings', icon: Settings },
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
    <header className="shrink-0 border-b border-emerald-700/20 bg-line-green text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-5 lg:px-8">
        <BrandLogo decorative className="h-9 w-9 shrink-0" />
        <span className="hidden truncate text-base font-bold sm:block">{t('brandName')}</span>
        <div className="ml-auto">
          <LanguageSwitcher compact />
        </div>
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
        <main className="flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-5 sm:py-6 lg:px-8">
          <LineFriendshipPrompt />
          <Outlet />
        </main>

        {/* ── Bottom tab bar ── */}
        <nav
          aria-label={t('accessibility.mainNavigation')}
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-2xl items-stretch border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
        >
          {NAV_ITEMS.slice(0, 2).map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-line-green' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-4 top-0 h-0.5 rounded-full ${
                      isActive ? 'bg-line-green' : 'bg-transparent'
                    }`}
                  />
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                  <span className="line-clamp-2 text-center text-[11px] leading-3">
                    {t(labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <QrScannerButton scanQrCode={liff.scanQrCode} />
          {NAV_ITEMS.slice(2).map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-line-green' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-4 top-0 h-0.5 rounded-full ${
                      isActive ? 'bg-line-green' : 'bg-transparent'
                    }`}
                  />
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                  <span className="line-clamp-2 text-center text-[11px] leading-3">
                    {t(labelKey)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </LiffRuntimeProvider>
  );
}
