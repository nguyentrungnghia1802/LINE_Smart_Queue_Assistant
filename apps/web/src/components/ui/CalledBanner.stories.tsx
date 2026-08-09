import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect } from 'storybook/test';

import { CalledBanner } from './CalledBanner';

const meta = {
  title: 'Customer/CalledBanner',
  component: CalledBanner,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CalledBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CalledTicket: Story = {
  args: { ticketDisplay: 'A019', onDismiss: () => undefined },
};

function DismissibleBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <CalledBanner ticketDisplay="A019" onDismiss={() => setVisible(false)} />;
}

export const Dismissible: Story = {
  args: { ticketDisplay: 'A019', onDismiss: () => undefined },
  render: () => <DismissibleBanner />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};
