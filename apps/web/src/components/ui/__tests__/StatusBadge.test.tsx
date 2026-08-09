import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('maps the persisted served queue state to the localized completed label', () => {
    render(<StatusBadge status="served" />);

    expect(screen.getByText('完了')).toBeInTheDocument();
  });
});
