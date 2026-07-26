import { LayoutDashboard, ListOrdered, PackageSearch, QrCode, Settings, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { RoleAppShell, type RoleNavItem } from '../../components/layout/RoleAppShell';
import { useAuthStore } from '../../store/authStore';

const MANAGER_NAV_ITEMS: RoleNavItem[] = [
  { to: '/manager', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/products', labelKey: 'nav.products', icon: PackageSearch },
  { to: '/manager/queues', labelKey: 'nav.queue', icon: ListOrdered },
  { to: '/manager/users', labelKey: 'nav.staff', icon: Users },
  { to: '/manager/qr', labelKey: 'nav.qr', icon: QrCode },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

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

  return <RoleAppShell homePath="/manager" navItems={MANAGER_NAV_ITEMS} />;
}
