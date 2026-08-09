import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expect } from 'storybook/test';

import { Pagination } from './Pagination';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

function PaginationPreview() {
  const { t } = useTranslation('common');
  const [page, setPage] = useState(1);
  return (
    <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white">
      <Pagination
        page={page}
        totalItems={42}
        pageSize={15}
        onPageChange={setPage}
        previousLabel={t('pagination.previous')}
        nextLabel={t('pagination.next')}
        pageLabel={(currentPage, totalPages) =>
          t('pagination.page', { page: currentPage, totalPages })
        }
      />
    </div>
  );
}

export const FifteenRowsPerPage: Story = {
  args: {
    page: 1,
    totalItems: 42,
    previousLabel: '',
    nextLabel: '',
    pageLabel: () => '',
    onPageChange: () => undefined,
  },
  render: () => <PaginationPreview />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button')[1]);
    await expect(canvas.getByText(/2/)).toBeInTheDocument();
  },
};
