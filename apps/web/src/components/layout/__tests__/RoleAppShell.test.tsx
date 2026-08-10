import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  BellRing,
  LayoutDashboard,
  ListOrdered,
  PackageSearch,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';
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
  { to: '/manager/notifications', labelKey: 'nav.notificationOperations', icon: BellRing },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

describe('RoleAppShell', () => {
  it('renders desktop navigation with all items (JSDOM fits all due to 0 width) and mobile navigation with More menu for >5 items', () => {
    // JSDOM doesn't support ResizeObserver, so we mock it to just run once
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );

    render(
      <MemoryRouter initialEntries={['/manager']}>
        <RoleAppShell homePath="/manager" navItems={navItems}>
          <h1>Manager content</h1>
        </RoleAppShell>
      </MemoryRouter>
    );

    const navigations = screen.getAllByRole('navigation', { name: 'メインナビゲーション' });
    expect(navigations).toHaveLength(2); // Desktop and Mobile

    const desktopNav = navigations[0];
    const mobileNav = navigations[1];

    // Desktop nav in JSDOM will render all items because offsetWidth is 0
    expect(within(desktopNav).getAllByRole('link', { name: 'ダッシュボード' })[0]).toHaveAttribute(
      'href',
      '/manager'
    );
    expect(within(desktopNav).getAllByRole('link', { name: '設定' })[0]).toBeInTheDocument();

    // Mobile nav has > 5 items, so it should render 4 items + "その他" (More)
    expect(within(mobileNav).getByRole('link', { name: 'ダッシュボード' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: '商品' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'キュー' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'スタッフ' })).toBeInTheDocument();

    // Items beyond the 4th should NOT be in the main mobile nav initially
    expect(within(mobileNav).queryByRole('link', { name: 'QR表示' })).not.toBeInTheDocument();

    // Instead, there should be a "More" button
    const moreButton = within(mobileNav).getByRole('button', { name: /その他/ });
    expect(moreButton).toBeInTheDocument();

    // Clicking "More" opens the dropdown with the remaining items
    fireEvent.click(moreButton);

    // Now the remaining items should be visible
    expect(screen.getByRole('menuitem', { name: 'QR表示' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'LINE配信' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '設定' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Manager content' })).toBeInTheDocument();
  });
});
