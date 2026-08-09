import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { expect } from 'storybook/test';

import { type QueueProductOption, QueueProductPicker } from './QueueProductPicker';

const products: QueueProductOption[] = [
  { id: 'product-cut', product_code: 'DV1', name: 'Cut and shampoo', is_active: true },
  { id: 'product-color', product_code: 'DV2', name: 'Hair color', is_active: true },
  { id: 'product-water', product_code: 'SP1', name: 'Mineral water', is_active: true },
  { id: 'product-archived', product_code: 'SP2', name: 'Discontinued item', is_active: false },
];

const meta = {
  title: 'Manager/QueueProductPicker',
  component: QueueProductPicker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof QueueProductPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractivePicker(args: ComponentProps<typeof QueueProductPicker>) {
  const [selectedIds, setSelectedIds] = useState(args.selectedIds);
  return <QueueProductPicker {...args} selectedIds={selectedIds} onChange={setSelectedIds} />;
}

export const EmptySelection: Story = {
  args: { products, selectedIds: [], onChange: () => undefined },
  render: (args) => <InteractivePicker {...args} />,
};

export const SelectedProducts: Story = {
  args: { products, selectedIds: ['product-cut', 'product-color'], onChange: () => undefined },
  render: (args) => <InteractivePicker {...args} />,
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const NoAvailableProducts: Story = {
  args: {
    products: products.map((product) => ({ ...product, is_active: false })),
    selectedIds: [],
    onChange: () => undefined,
  },
  render: (args) => <InteractivePicker {...args} />,
};

export const CanToggleProducts: Story = {
  args: { products, selectedIds: [], onChange: () => undefined },
  render: (args) => <InteractivePicker {...args} />,
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole('checkbox', { name: /Cut and shampoo/ });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
