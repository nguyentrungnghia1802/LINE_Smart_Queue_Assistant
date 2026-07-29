import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { post } from '../../../services/apiClient';
import { BranchLocationPicker } from '../BranchLocationPicker';

vi.mock('../../../services/apiClient', () => ({
  post: vi.fn(),
}));

describe('BranchLocationPicker', () => {
  it('searches and returns the selected Google place', async () => {
    vi.mocked(post).mockResolvedValue([
      {
        latitude: 35.681236,
        longitude: 139.767125,
        placeId: 'place-tokyo',
        formattedAddress: 'Tokyo Station, Tokyo, Japan',
      },
    ]);
    const onChange = vi.fn();
    render(<BranchLocationPicker addressQuery="Tokyo Station" value={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Tokyo Station' },
    });
    fireEvent.click(screen.getByRole('button', { name: '地図を検索' }));

    expect(await screen.findByText('Tokyo Station, Tokyo, Japan')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tokyo Station, Tokyo, Japan'));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        latitude: 35.681236,
        longitude: 139.767125,
        placeId: 'place-tokyo',
        formattedAddress: 'Tokyo Station, Tokyo, Japan',
      })
    );
  });
});
