import { useTranslation } from 'react-i18next';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { AccountMenu } from '../../components/layout/AccountMenu';
import { useAuthStore } from '../../store/authStore';

export function ManagerLayout() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAllowed = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="rounded-2xl border border-white/80 bg-white p-8 text-gray-600 shadow-[var(--shadow-soft)]">
          {t('errors.FORBIDDEN')}
        </p>
      </div>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
          <Link to="/manager" className="mr-4 flex items-center gap-3 font-bold text-gray-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm text-white">
              LQ
            </span>
            <span>LINE Queue</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            <NavLink to="/manager" end className={navClass}>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/manager/products" className={navClass}>
              {t('nav.products')}
            </NavLink>
            <NavLink to="/manager/users" className={navClass}>
              {t('nav.staff')}
            </NavLink>
            <NavLink to="/manager/qr" className={navClass}>
              {t('nav.qr')}
            </NavLink>
            <NavLink to="/manager/settings" className={navClass}>
              {t('nav.settings')}
            </NavLink>
          </nav>
          <LanguageSwitcher compact />
          <AccountMenu />
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
