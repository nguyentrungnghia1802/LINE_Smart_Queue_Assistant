import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BellRing,
  LayoutDashboard,
  ListOrdered,
  PackageSearch,
  QrCode,
  Settings,
  Users,
} from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { managerStoryUser, StoryAuthProvider } from '../../storybook/providers';

import { RoleAppShell, type RoleNavItem } from './RoleAppShell';

const navItems: RoleNavItem[] = [
  { to: '/manager', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/products', labelKey: 'nav.products', icon: PackageSearch },
  { to: '/manager/queues', labelKey: 'nav.queue', icon: ListOrdered },
  { to: '/manager/users', labelKey: 'nav.staff', icon: Users },
  { to: '/manager/qr', labelKey: 'nav.qr', icon: QrCode },
  { to: '/manager/notifications', labelKey: 'nav.notificationOperations', icon: BellRing },
  { to: '/manager/settings', labelKey: 'nav.settings', icon: Settings },
];

const meta = {
  title: 'Layout/RoleAppShell',
  component: RoleAppShell,
  tags: ['autodocs'],
  parameters: {
    router: { initialEntries: ['/manager'] },
    docs: {
      description: {
        component:
          'Shared business navigation. Desktop renders items responsively with a More dropdown for overflow; phone layouts use a bottom navigation with a More menu for >5 items.',
      },
    },
  },
} satisfies Meta<typeof RoleAppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function ShellPreview(args: ComponentProps<typeof RoleAppShell>) {
  const { t } = useTranslation('common');
  return (
    <StoryAuthProvider user={managerStoryUser}>
      <RoleAppShell {...args}>
        <section className="min-h-[30rem] rounded-xl border border-dashed border-gray-300 bg-white p-6">
          <p className="text-sm font-semibold text-brand-700">{t('nav.dashboard')}</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">{t('nav.queue')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
            {t('accessibility.mainNavigation')}
          </p>
        </section>
      </RoleAppShell>
    </StoryAuthProvider>
  );
}

export const Desktop: Story = {
  args: { homePath: '/manager', navItems, contentMode: 'contained' },
  render: (args) => <ShellPreview {...args} />,
};

// We can mock a narrow viewport using an inline style constraint for Storybook testing.
export const DesktopNarrowOverflow: Story = {
  args: { homePath: '/manager', navItems, contentMode: 'contained' },
  render: (args) => (
    <div style={{ maxWidth: '800px', width: '100%', borderRight: '1px solid #ccc' }}>
      <ShellPreview {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: { story: 'Constrained width to demonstrate the More dropdown in desktop.' },
    },
  },
};

export const PhoneWorkspace: Story = {
  args: { homePath: '/manager', navItems, contentMode: 'workspace' },
  render: (args) => <ShellPreview {...args} />,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
