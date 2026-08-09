import type { Meta, StoryObj } from '@storybook/react-vite';

import { orderFixtures } from '../../storybook/fixtures';

import { CustomerOrderDetails } from './CustomerOrderDetails';

const meta = {
  title: 'Ticket/CustomerOrderDetails',
  component: CustomerOrderDetails,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Customer-facing order summary shared by current-ticket and ticket-detail views. It distinguishes collected prepaid value, order total, and the remaining balance.',
      },
    },
  },
} satisfies Meta<typeof CustomerOrderDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PartiallyPaid: Story = {
  args: { order: orderFixtures.partiallyPaid },
};

export const FullyPaidOnPhone: Story = {
  args: { order: orderFixtures.paid },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
