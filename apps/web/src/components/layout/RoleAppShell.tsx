import type { LucideIcon } from 'lucide-react';
import { Menu, MoreHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

import { AccountMenu } from './AccountMenu';
import { useOverflowNav } from './useOverflowNav';

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
  const location = useLocation();

  // Desktop overflow logic
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const { visibleItems: desktopVisible, overflowItems: desktopOverflow } = useOverflowNav(
    navItems,
    desktopNavRef,
    90 // More button width approx
  );

  const [isDesktopMoreOpen, setIsDesktopMoreOpen] = useState(false);
  const desktopMoreRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or route change
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(event.target as Node)) {
        setIsDesktopMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsDesktopMoreOpen(false);
    setIsMobileMoreOpen(false);
  }, [location.pathname]);

  const isDesktopOverflowActive = desktopOverflow.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  // Mobile logic: Max 4 items visible, rest in More
  const mobileMaxVisible = 4;
  const showMobileMore = navItems.length > 5;
  const mobileVisible = showMobileMore ? navItems.slice(0, mobileMaxVisible) : navItems;
  const mobileOverflow = showMobileMore ? navItems.slice(mobileMaxVisible) : [];
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(event.target as Node)) {
        setIsMobileMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMobileOverflowActive = mobileOverflow.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

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

          <div ref={desktopNavRef} className="relative hidden min-w-0 flex-1 items-center lg:flex">
            {/* Hidden measuring track */}
            <div
              data-measure-track="true"
              className="pointer-events-none absolute left-0 top-0 flex invisible gap-1 opacity-0"
              aria-hidden="true"
            >
              {navItems.map(({ to, labelKey, icon: Icon }) => (
                <div
                  key={to}
                  className="inline-flex min-h-10 items-center gap-2 px-3 py-2 text-sm font-semibold"
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="whitespace-nowrap">{t(labelKey)}</span>
                </div>
              ))}
            </div>

            {/* Visible Items */}
            <nav aria-label={t('accessibility.mainNavigation')} className="flex items-center gap-1">
              {desktopVisible.map(({ to, labelKey, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={desktopNavClass}>
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="whitespace-nowrap">{t(labelKey)}</span>
                </NavLink>
              ))}

              {/* Desktop Overflow More Button */}
              {desktopOverflow.length > 0 && (
                <div className="relative ml-1" ref={desktopMoreRef}>
                  <button
                    type="button"
                    onClick={() => setIsDesktopMoreOpen((prev) => !prev)}
                    aria-expanded={isDesktopMoreOpen}
                    aria-haspopup="menu"
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      isDesktopMoreOpen || isDesktopOverflowActive
                        ? 'bg-gray-950 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                    }`}
                  >
                    <MoreHorizontal
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                    />
                    <span className="whitespace-nowrap">{t('nav.more')}</span>
                  </button>

                  {isDesktopMoreOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                    >
                      {desktopOverflow.map(({ to, labelKey, icon: Icon, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          role="menuitem"
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                              isActive
                                ? 'bg-gray-50 text-brand-700'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`
                          }
                          onClick={() => setIsDesktopMoreOpen(false)}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                          <span className="truncate">{t(labelKey)}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <main
        className={
          contentMode === 'workspace'
            ? 'flex min-h-0 min-w-0 flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:pb-8'
        }
      >
        {children ?? <Outlet />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label={t('accessibility.mainNavigation')}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      >
        {mobileVisible.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={t(labelKey)}
            className={({ isActive }) =>
              `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors ${
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

        {showMobileMore && (
          <div className="flex-1" ref={mobileMoreRef}>
            <button
              type="button"
              onClick={() => setIsMobileMoreOpen((prev) => !prev)}
              aria-expanded={isMobileMoreOpen}
              aria-haspopup="menu"
              className={`relative flex h-full min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors ${
                isMobileMoreOpen || isMobileOverflowActive
                  ? 'text-brand-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-3 top-0 h-0.5 rounded-full ${
                  isMobileMoreOpen || isMobileOverflowActive ? 'bg-brand-600' : 'bg-transparent'
                }`}
              />
              <Menu aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
              <span className="line-clamp-2 w-full text-[10px] font-semibold leading-3 sm:text-xs">
                {t('nav.more')}
              </span>
            </button>

            {isMobileMoreOpen && (
              <div
                role="menu"
                className="absolute bottom-full right-2 mb-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
              >
                {mobileOverflow.map(({ to, labelKey, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    role="menuitem"
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                    onClick={() => setIsMobileMoreOpen(false)}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>{t(labelKey)}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
