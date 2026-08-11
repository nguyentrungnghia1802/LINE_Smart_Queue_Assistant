import type { Meta, StoryObj } from '@storybook/react-vite';

import { RouteLoadingState } from './RouteLoadingState';

const meta = {
  title: 'UI/RouteLoadingState',
  component: RouteLoadingState,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RouteLoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
