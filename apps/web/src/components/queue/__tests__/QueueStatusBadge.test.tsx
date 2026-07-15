import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QueueStatus } from '@line-queue/shared';

import { QueueStatusBadge } from '../QueueStatusBadge';

describe('QueueStatusBadge', () => {
  it('renders Japanese label for ACTIVE status', () => {
    render(<QueueStatusBadge status={QueueStatus.ACTIVE} />);
    expect(screen.getByText('稼働中')).toBeInTheDocument();
  });

  it('renders Japanese label for PAUSED status', () => {
    render(<QueueStatusBadge status={QueueStatus.PAUSED} />);
    expect(screen.getByText('一時停止')).toBeInTheDocument();
  });

  it('renders Japanese label for CLOSED status', () => {
    render(<QueueStatusBadge status={QueueStatus.CLOSED} />);
    expect(screen.getByText('終了')).toBeInTheDocument();
  });

  it('applies green classes for ACTIVE', () => {
    render(<QueueStatusBadge status={QueueStatus.ACTIVE} />);
    const badge = screen.getByText('稼働中');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });
});
