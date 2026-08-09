import type { Meta, StoryObj } from '@storybook/react-vite';

import { ticketFixtures } from '../../storybook/fixtures';

import { TicketCard } from './TicketCard';

const meta = {
  title: 'Ticket/TicketCard',
  component: TicketCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: { onClick: { action: 'open ticket' } },
} satisfies Meta<typeof TicketCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  args: { ticket: ticketFixtures.waiting },
};

export const CalledOnPhone: Story = {
  args: { ticket: ticketFixtures.called },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const Completed: Story = {
  args: { ticket: ticketFixtures.completed },
};
