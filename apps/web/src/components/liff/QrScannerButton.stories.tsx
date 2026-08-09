import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLocation } from 'react-router-dom';
import { expect } from 'storybook/test';

import { QrScannerButton } from './QrScannerButton';

const meta = {
  title: 'LIFF/QrScannerButton',
  component: QrScannerButton,
  tags: ['autodocs'],
  parameters: {
    router: { initialEntries: ['/liff/home'] },
    docs: {
      description: {
        component:
          'Uses the native LIFF scanner callback when supplied and keeps the body-portal camera fallback for browsers that do not expose it.',
      },
    },
  },
} satisfies Meta<typeof QrScannerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

function LocationProbe() {
  const location = useLocation();
  return <output className="ml-4 text-xs text-gray-500">{location.pathname}</output>;
}

export const NativeScannerNavigation: Story = {
  render: () => (
    <div className="flex items-center rounded-xl border border-gray-200 bg-white p-3">
      <QrScannerButton scanQrCode={async () => '/qr/demo-queue-lab-2026'} />
      <LocationProbe />
    </div>
  ),
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('/liff/qr/demo-queue-lab-2026')).toBeInTheDocument();
  },
};
