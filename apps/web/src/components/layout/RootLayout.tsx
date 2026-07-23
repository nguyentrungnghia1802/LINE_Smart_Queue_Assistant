import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../../store/authStore';
import { BrandLogo } from '../BrandLogo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

import { AccountMenu } from './AccountMenu';

const NAV_LINKS = [
  { to: '/app', labelKey: 'nav.dashboard', end: true },
  { to: '/app/queues', labelKey: 'nav.queue' },
];

export function RootLayout() {
  const { user } = useAuthStore();
  const { t } = useTranslation('common');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold text-gray-950">
            <BrandLogo decorative />
            <span>LINE Queue</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ to, labelKey, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-950 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {t(labelKey)}
              </NavLink>
            ))}
            {user?.role === UserRole.ADMIN && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-950 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {t('nav.dashboard')}
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageSwitcher compact />
            </div>
            <div className="hidden sm:block">
              <AccountMenu />
            </div>

            {/* Mobile hamburger */}
            <button
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 sm:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t('accessibility.toggleMenu')}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="space-y-1 border-t border-gray-100 bg-white px-4 py-3 sm:hidden">
            {NAV_LINKS.map(({ to, labelKey, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-gray-950 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {t(labelKey)}
              </NavLink>
            ))}
            {user?.role === UserRole.ADMIN && (
              <NavLink
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-gray-950 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {t('nav.dashboard')}
              </NavLink>
            )}
            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="mb-2 px-3">
                <LanguageSwitcher />
              </div>
              <AccountMenu compact />
            </div>
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
