import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserMenuName } from '../UserMenuName';

describe('UserMenuName', () => {
  it('keeps long names within two lines and exposes the full value as a title', () => {
    const name = 'A very long organization manager display name that cannot fit on one line';
    render(<UserMenuName name={name} compact />);

    const label = screen.getByText(name);
    expect(label).toHaveClass('line-clamp-2', 'text-[10px]');
    expect(label).toHaveAttribute('title', name);
  });

  it('keeps regular names at the standard navigation size', () => {
    render(<UserMenuName name="Manager Test" />);

    expect(screen.getByText('Manager Test')).toHaveClass('text-sm');
  });
});
