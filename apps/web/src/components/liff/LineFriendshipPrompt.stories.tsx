import type { Meta, StoryObj } from '@storybook/react-vite';

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
