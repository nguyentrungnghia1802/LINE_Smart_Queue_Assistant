import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { QueueSummary } from '@line-queue/shared';
import { QueueStatus } from '@line-queue/shared';

import { QueueCard } from '../QueueCard';

const mockQueue: QueueSummary = {
  id: 'q-123',
  name: 'Test Queue',
  description: 'A test queue description',
  status: QueueStatus.ACTIVE,
  currentNumber: 7,
  waitingCount: 1,
  calledCount: 1,
  servingCount: 0,
  maxCapacity: 50,
  avgServiceTimeMinutes: 5,
  organizationId: 'org-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderQueueCard() {
  return render(
    <MemoryRouter>
      <QueueCard queue={mockQueue} />
    </MemoryRouter>
  );
}

describe('QueueCard', () => {
  it('renders the queue name', () => {
    renderQueueCard();
    expect(screen.getByText('Test Queue')).toBeInTheDocument();
  });

  it('renders the description', () => {
    renderQueueCard();
    expect(screen.getByText('A test queue description')).toBeInTheDocument();
  });

  it('renders the active status badge', () => {
    renderQueueCard();
    expect(screen.getByText('稼働中')).toBeInTheDocument();
  });

  it('links to the queue detail page', () => {
    renderQueueCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/manager/queues/q-123');
  });

  it('renders the live active customer count instead of the issued ticket counter', () => {
    renderQueueCard();
    expect(screen.getByText('受付中のお客様:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('007')).not.toBeInTheDocument();
  });

  it('renders capacity when provided', () => {
    renderQueueCard();
    expect(screen.getByText('50')).toBeInTheDocument();
  });
});
