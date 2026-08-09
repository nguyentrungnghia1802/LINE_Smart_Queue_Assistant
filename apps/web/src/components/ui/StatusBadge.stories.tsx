import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: [
        'waiting',
        'called',
        'serving',
        'served',
        'completed',
        'cancelled',
        'skipped',
        'no_show',
      ],
    },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  args: { status: 'waiting', size: 'md' },
};

export const CalledOnPhone: Story = {
  args: { status: 'called', size: 'md' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const Completed: Story = {
  args: { status: 'served', size: 'sm' },
};
