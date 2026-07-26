import { render, screen, within } from '@testing-library/react';
import { LayoutDashboard, ListOrdered, PackageSearch, QrCode, Settings, Users } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { RoleAppShell, type RoleNavItem } from '../RoleAppShell';

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { displayName: 'Manager Test', role: 'manager' },
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));

const navItems: RoleNavItem[] = [
  { to: '/manager', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/products', labelKey: 'nav.products', icon: PackageSearch },
  { to: '/manager/queues', labelKey: 'nav.queue', icon: ListOrdered },
  { to: '/manager/users', labelKey: 'nav.staff', icon: Users },
  { to: '/manager/qr', labelKey: 'nav.qr', icon: QrCode },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

describe('RoleAppShell', () => {
  it('keeps every role destination available in desktop and mobile navigation', () => {
    render(
      <MemoryRouter initialEntries={['/manager']}>
        <RoleAppShell homePath="/manager" navItems={navItems}>
          <h1>Manager content</h1>
        </RoleAppShell>
      </MemoryRouter>
    );

    const navigations = screen.getAllByRole('navigation', { name: 'メインナビゲーション' });
    expect(navigations).toHaveLength(2);

    for (const navigation of navigations) {
      expect(within(navigation).getByRole('link', { name: 'ダッシュボード' })).toHaveAttribute(
        'href',
        '/manager'
      );
      expect(within(navigation).getByRole('link', { name: '商品' })).toBeInTheDocument();
      expect(within(navigation).getByRole('link', { name: 'キュー' })).toBeInTheDocument();
      expect(within(navigation).getByRole('link', { name: 'スタッフ' })).toBeInTheDocument();
      expect(within(navigation).getByRole('link', { name: 'QR表示' })).toBeInTheDocument();
      expect(within(navigation).getByRole('link', { name: '設定' })).toBeInTheDocument();
    }

    expect(navigations[1]).toHaveStyle({
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    });
    expect(screen.getByRole('heading', { name: 'Manager content' })).toBeInTheDocument();
  });
});
