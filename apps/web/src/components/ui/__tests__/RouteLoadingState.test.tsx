import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RouteLoadingState } from '../RouteLoadingState';

describe('RouteLoadingState', () => {
  it('announces the localized loading state without blocking responsive layout', () => {
    const { container } = render(<RouteLoadingState />);

    expect(screen.getByText('読み込み中')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAccessibleName('読み込み中');
    expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('main')).toHaveAttribute('aria-live', 'polite');
  });
});
