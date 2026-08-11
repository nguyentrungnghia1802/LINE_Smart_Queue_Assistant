import type { Meta, StoryObj } from '@storybook/react-vite';

import { Spinner } from './Spinner';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    className: { control: 'text' },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { size: 'md' } };

export const LargeLoadingIndicator: Story = {
  args: { size: 'lg' },
};

export const ReducedMotion: Story = {
  args: { size: 'lg' },
  parameters: {
    chromatic: { prefersReducedMotion: 'reduce' },
  },
};
