import { LayoutDashboard, ListOrdered, ShieldCheck } from 'lucide-react';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../../store/authStore';

import { RoleAppShell, type RoleNavItem } from './RoleAppShell';

const APP_NAV_ITEMS: RoleNavItem[] = [
  { to: '/app', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/queues', labelKey: 'nav.queue', icon: ListOrdered },
];

export function RootLayout() {
  const { user } = useAuthStore();
  const navItems =
    user?.role === UserRole.ADMIN
      ? [
          ...APP_NAV_ITEMS,
          { to: '/admin', labelKey: 'nav.admin', icon: ShieldCheck } satisfies RoleNavItem,
        ]
      : APP_NAV_ITEMS;

  return <RoleAppShell homePath="/app" navItems={navItems} />;
}
