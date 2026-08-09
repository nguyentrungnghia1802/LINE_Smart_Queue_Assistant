import {
  BellRing,
  Building2,
  ClipboardList,
  LayoutDashboard,
  ListOrdered,
  PackageSearch,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { RoleAppShell, type RoleNavItem } from '../../components/layout/RoleAppShell';
import { useAuthStore } from '../../store/authStore';

const BRANCH_MANAGER_NAV_ITEMS: RoleNavItem[] = [
  { to: '/manager', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/products', labelKey: 'nav.products', icon: PackageSearch },
  { to: '/manager/queues', labelKey: 'nav.queue', icon: ListOrdered },
  { to: '/manager/users', labelKey: 'nav.staff', icon: Users },
  { to: '/manager/qr', labelKey: 'nav.qr', icon: QrCode },
  { to: '/manager/notifications', labelKey: 'nav.notificationOperations', icon: BellRing },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

const OWNER_MANAGER_NAV_ITEMS: RoleNavItem[] = [
  { to: '/manager', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/products', labelKey: 'nav.products', icon: PackageSearch },
  { to: '/manager/branches', labelKey: 'nav.branches', icon: Building2 },
  { to: '/manager/audit', labelKey: 'nav.audit', icon: ClipboardList },
  { to: '/manager/notifications', labelKey: 'nav.notificationOperations', icon: BellRing },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

export function ManagerLayout() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAllowed = user.role === UserRole.MANAGER;

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="rounded-2xl border border-white/80 bg-white p-8 text-gray-600 shadow-[var(--shadow-soft)]">
          {t('errors.FORBIDDEN')}
        </p>
      </div>
    );
  }

  const ownerPathAllowed =
    location.pathname === '/manager' ||
    location.pathname.startsWith('/manager/products') ||
    location.pathname.startsWith('/manager/branches') ||
    location.pathname.startsWith('/manager/audit') ||
    location.pathname.startsWith('/manager/notifications') ||
    location.pathname.startsWith('/manager/settings');
  const branchPathForbidden =
    location.pathname.startsWith('/manager/branches') ||
    location.pathname.startsWith('/manager/audit');
  if (
    (user.isOrganizationOwner && !ownerPathAllowed) ||
    (!user.isOrganizationOwner && branchPathForbidden)
  ) {
    return <Navigate to="/manager" replace />;
  }

  return (
    <RoleAppShell
      homePath="/manager"
      navItems={user.isOrganizationOwner ? OWNER_MANAGER_NAV_ITEMS : BRANCH_MANAGER_NAV_ITEMS}
    />
  );
}
