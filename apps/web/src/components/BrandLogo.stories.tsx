import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandLogo } from './BrandLogo';

const meta = {
  title: 'Brand/BrandLogo',
  component: BrandLogo,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    className: { control: 'text' },
    decorative: { control: 'boolean' },
  },
} satisfies Meta<typeof BrandLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAccessibleName: Story = {
  args: { className: 'h-16 w-16', decorative: false },
};

export const DecorativeInNavigation: Story = {
  args: { className: 'h-10 w-10', decorative: true },
};
