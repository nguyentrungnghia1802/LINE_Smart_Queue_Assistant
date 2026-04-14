import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders without crashing', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('applies md size by default', () => {
    render(<Spinner />);
    const svg = screen.getByRole('status');
    expect(svg.getAttribute('class')).toContain('h-6');
    expect(svg.getAttribute('class')).toContain('w-6');
  });

  it('applies sm size when specified', () => {
    render(<Spinner size="sm" />);
    const svg = screen.getByRole('status');
    expect(svg.getAttribute('class')).toContain('h-4');
    expect(svg.getAttribute('class')).toContain('w-4');
  });

  it('applies lg size when specified', () => {
    render(<Spinner size="lg" />);
    const svg = screen.getByRole('status');
    expect(svg.getAttribute('class')).toContain('h-10');
    expect(svg.getAttribute('class')).toContain('w-10');
  });
});
