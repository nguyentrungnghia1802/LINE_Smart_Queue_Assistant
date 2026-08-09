import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { expect } from 'storybook/test';

import { LiffRuntimeProvider } from '../../contexts/LiffRuntimeContext';
import { friendshipContext } from '../../storybook/fixtures';

import { LineFriendshipPrompt } from './LineFriendshipPrompt';

const meta = {
  title: 'LIFF/LineFriendshipPrompt',
  component: LineFriendshipPrompt,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LineFriendshipPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsFriendship: Story = {
  decorators: [
    (Story) => (
      <LiffRuntimeProvider value={friendshipContext('not_friend')}>
        <Story />
      </LiffRuntimeProvider>
    ),
  ],
};

export const AlreadyConnected: Story = {
  decorators: [
    (Story) => (
      <LiffRuntimeProvider value={friendshipContext('friend')}>
        <Story />
      </LiffRuntimeProvider>
    ),
  ],
};

function FriendshipRequestFlow() {
  const [isFriend, setIsFriend] = useState(false);
  const context = useMemo(
    () => ({
      ...friendshipContext(isFriend ? 'friend' : 'not_friend'),
      requestFriendship: async () => {
        setIsFriend(true);
        return true;
      },
    }),
    [isFriend]
  );

  return (
    <LiffRuntimeProvider value={context}>
      <LineFriendshipPrompt />
    </LiffRuntimeProvider>
  );
}

export const AddFriendSuccess: Story = {
  render: () => <FriendshipRequestFlow />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.queryByRole('region')).not.toBeInTheDocument();
  },
};
