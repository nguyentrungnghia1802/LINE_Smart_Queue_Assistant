import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QueueStatus } from '@line-queue/shared';

import { QueueStatusBadge } from '../QueueStatusBadge';

describe('QueueStatusBadge', () => {
  it('renders "Active" for ACTIVE status', () => {
    render(<QueueStatusBadge status={QueueStatus.ACTIVE} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders "Paused" for PAUSED status', () => {
    render(<QueueStatusBadge status={QueueStatus.PAUSED} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('renders "Closed" for CLOSED status', () => {
    render(<QueueStatusBadge status={QueueStatus.CLOSED} />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('applies green classes for ACTIVE', () => {
    render(<QueueStatusBadge status={QueueStatus.ACTIVE} />);
    const badge = screen.getByText('Active');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });
});
