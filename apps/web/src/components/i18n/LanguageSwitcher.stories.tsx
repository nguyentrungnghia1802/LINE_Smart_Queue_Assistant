import type { Meta, StoryObj } from '@storybook/react-vite';

import { LanguageSwitcher } from './LanguageSwitcher';

const meta = {
  title: 'Brand/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The shared locale control persists anonymous choices locally and persists authenticated choices through the profile API.',
      },
    },
  },
  argTypes: { compact: { control: 'boolean' } },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { compact: false },
};

export const CompactOnPhone: Story = {
  args: { compact: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
