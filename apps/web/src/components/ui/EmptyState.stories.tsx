import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { fn } from 'storybook/test';

import { EmptyState } from './EmptyState';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

function LocalizedEmptyState({ withAction = false }: Readonly<{ withAction?: boolean }>) {
  const { t } = useTranslation('common');
  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white">
      <EmptyState
        icon="🎫"
        title={t('states.empty')}
        message={t('pages.notFoundDescription')}
        action={withAction ? { label: t('actions.open'), onClick: fn() } : undefined}
      />
    </div>
  );
}

export const WithoutAction: Story = {
  args: { title: '', message: '' },
  render: () => <LocalizedEmptyState />,
};

export const WithRecoveryAction: Story = {
  args: { title: '', message: '' },
  render: () => <LocalizedEmptyState withAction />,
};
