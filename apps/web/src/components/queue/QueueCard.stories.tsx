import type { Meta, StoryObj } from '@storybook/react-vite';

import { queueFixtures } from '../../storybook/fixtures';

import { QueueCard } from './QueueCard';

const meta = {
  title: 'Queue/QueueCard',
  component: QueueCard,
  tags: ['autodocs'],
  argTypes: {
    sequence: { control: { type: 'number', min: 1 } },
  },
} satisfies Meta<typeof QueueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { queue: queueFixtures.active, sequence: 1 },
};

export const PausedOnPhone: Story = {
  args: { queue: queueFixtures.paused, sequence: 2 },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const ClosedAndUnlimited: Story = {
  args: { queue: queueFixtures.closed, sequence: 3 },
};
