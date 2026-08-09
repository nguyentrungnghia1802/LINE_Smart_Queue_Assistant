import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ProfileSkeleton,
  QueueInfoSkeleton,
  Skeleton,
  TicketCardSkeleton,
  TicketHeroSkeleton,
} from './Skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: { className: { control: 'text' } },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleBlock: Story = {
  args: { className: 'h-5 w-48' },
};

export const CustomerTicketLoadingStates: Story = {
  render: () => (
    <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
      <TicketHeroSkeleton />
      <TicketCardSkeleton />
      <QueueInfoSkeleton />
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <ProfileSkeleton />
      </div>
    </div>
  ),
};
