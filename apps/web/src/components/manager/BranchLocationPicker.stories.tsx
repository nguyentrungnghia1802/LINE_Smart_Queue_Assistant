import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { BranchLocationPicker, type BranchMapLocation } from './BranchLocationPicker';

const meta = {
  title: 'Manager/BranchLocationPicker',
  component: BranchLocationPicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The initial state is intentionally rendered without network calls. Geocoding and the Google map embed remain integration boundaries; their search/selection behavior is covered by the component test with a mocked API response.',
      },
    },
  },
} satisfies Meta<typeof BranchLocationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function SearchReadyPreview() {
  const [value, setValue] = useState<BranchMapLocation | null>(null);
  return (
    <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-gray-50 p-5">
      <BranchLocationPicker addressQuery="Tokyo Station" value={value} onChange={setValue} />
    </div>
  );
}

export const SearchReady: Story = {
  args: { addressQuery: 'Tokyo Station', value: null, onChange: () => undefined },
  render: () => <SearchReadyPreview />,
};
