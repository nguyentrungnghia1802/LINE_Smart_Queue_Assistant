import type { Meta, StoryObj } from '@storybook/react-vite';

import { QueueStatus } from '@line-queue/shared';

import { QueueStatusBadge } from './QueueStatusBadge';

const meta = {
  title: 'Queue/QueueStatusBadge',
  component: QueueStatusBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    status: {
      control: 'select',
      options: [QueueStatus.ACTIVE, QueueStatus.PAUSED, QueueStatus.CLOSED],
    },
  },
} satisfies Meta<typeof QueueStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = { args: { status: QueueStatus.ACTIVE } };

export const Paused: Story = { args: { status: QueueStatus.PAUSED } };

export const Closed: Story = { args: { status: QueueStatus.CLOSED } };
