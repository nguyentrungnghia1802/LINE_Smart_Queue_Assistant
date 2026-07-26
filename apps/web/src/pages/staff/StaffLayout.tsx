import { ClipboardList, PackageSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { RoleAppShell, type RoleNavItem } from '../../components/layout/RoleAppShell';
import { useAuthStore } from '../../store/authStore';

const STAFF_NAV_ITEMS: RoleNavItem[] = [
  { to: '/staff', labelKey: 'nav.orders', icon: ClipboardList, end: true },
  { to: '/staff/products', labelKey: 'nav.products', icon: PackageSearch },
];

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

  return <RoleAppShell homePath="/staff" navItems={STAFF_NAV_ITEMS} contentMode="workspace" />;
}
