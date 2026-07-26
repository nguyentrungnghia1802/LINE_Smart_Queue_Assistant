import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

import { AccountMenu } from './AccountMenu';

export interface RoleNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

interface RoleAppShellProps {
  homePath: string;
  navItems: RoleNavItem[];
  contentMode?: 'contained' | 'workspace';
  children?: ReactNode;
}

const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-gray-950 text-white shadow-sm'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
  }`;

export function RoleAppShell({
  homePath,
  navItems,
  contentMode = 'contained',
  children,
}: Readonly<RoleAppShellProps>) {
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-[var(--app-bg)]">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-3 sm:px-5 lg:px-8">
          <Link
            to={homePath}
            className="flex min-w-0 shrink-0 items-center gap-2.5 font-bold text-gray-950"
          >
            <BrandLogo decorative className="h-9 w-9 shrink-0" />
            <span className="hidden truncate text-base sm:block lg:max-w-52 xl:max-w-none">
              {t('brandName')}
            </span>
          </Link>

          <nav
            aria-label={t('accessibility.mainNavigation')}
            className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
          >
            {navItems.map(({ to, labelKey, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={desktopNavClass}>
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="whitespace-nowrap">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <main
        className={
          contentMode === 'workspace'
            ? 'flex min-h-0 min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:pb-8'
        }
      >
        {children ?? <Outlet />}
      </main>

      <nav
        aria-label={t('accessibility.mainNavigation')}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex snap-x snap-mandatory overflow-x-auto border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      >
        {navItems.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={t(labelKey)}
            className={({ isActive }) =>
              `relative flex min-h-16 min-w-[4.75rem] flex-1 snap-start flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors ${
                isActive ? 'text-brand-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full ${
                    isActive ? 'bg-brand-600' : 'bg-transparent'
                  }`}
                />
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
                <span className="line-clamp-2 w-full text-[10px] font-semibold leading-3 sm:text-xs">
                  {t(labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
