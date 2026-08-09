import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { fn } from 'storybook/test';

import { ErrorState } from './ErrorState';

const meta = {
  title: 'UI/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

function LocalizedErrorState({ withRetry = false }: Readonly<{ withRetry?: boolean }>) {
  const { t } = useTranslation('common');
  return (
    <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white">
      <ErrorState
        title={t('errors.SERVICE_UNAVAILABLE')}
        message={t('errors.NETWORK_ERROR')}
        retryLabel={t('actions.retry')}
        onRetry={withRetry ? fn() : undefined}
      />
    </div>
  );
}

export const RecoverableNetworkError: Story = {
  args: { message: '' },
  render: () => <LocalizedErrorState withRetry />,
};

export const NonRecoverableError: Story = {
  args: { message: '' },
  render: () => <LocalizedErrorState />,
};
