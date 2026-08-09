import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';

import { BrandLogo } from '../BrandLogo';

import { StandalonePageTopBar } from './StandalonePageTopBar';

const meta = {
  title: 'Layout/StandalonePageTopBar',
  component: StandalonePageTopBar,
  tags: ['autodocs'],
  parameters: { router: { initialEntries: ['/login'] } },
} satisfies Meta<typeof StandalonePageTopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

function LoginHeaderContent() {
  const { t } = useTranslation('common');
  return (
    <StandalonePageTopBar>
      <div className="flex items-center gap-3">
        <BrandLogo decorative className="h-9 w-9" />
        <span className="truncate font-bold text-gray-950">{t('brandName')}</span>
      </div>
    </StandalonePageTopBar>
  );
}

export const LoginHeader: Story = {
  render: () => <LoginHeaderContent />,
};

export const PhoneHeader: Story = {
  ...LoginHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
