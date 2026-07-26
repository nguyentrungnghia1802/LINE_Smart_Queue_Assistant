import { Building2, ClipboardCheck, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { RoleAppShell, type RoleNavItem } from '../../components/layout/RoleAppShell';
import { useAuthStore } from '../../store/authStore';

const ADMIN_NAV_ITEMS: RoleNavItem[] = [
  { to: '/admin', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orgs', labelKey: 'nav.organizations', icon: Building2 },
  { to: '/admin/applications', labelKey: 'nav.applications', icon: ClipboardCheck },
];

export function AdminLayout() {
  const { t } = useTranslation('common');
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="rounded-2xl border border-white/80 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-gray-700 font-medium">{t('errors.FORBIDDEN')}</p>
        </div>
      </div>
    );
  }

  return <RoleAppShell homePath="/admin" navItems={ADMIN_NAV_ITEMS} />;
}
