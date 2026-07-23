import { useTranslation } from 'react-i18next';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { BrandLogo } from '../../components/BrandLogo';
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { AccountMenu } from '../../components/layout/AccountMenu';
import { useAuthStore } from '../../store/authStore';

export function StaffLayout() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAllowed =
    user.role === UserRole.STAFF || user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

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
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
          <Link to="/staff" className="mr-4 flex items-center gap-3 font-bold text-gray-950">
            <BrandLogo decorative />
            <span className="hidden sm:inline">{t('brandName')}</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            <NavLink to="/staff" end className={navClass}>
              {t('nav.orders')}
            </NavLink>
            <NavLink to="/staff/products" className={navClass}>
              {t('nav.products')}
            </NavLink>
          </nav>
          <LanguageSwitcher compact />
          <AccountMenu />
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
