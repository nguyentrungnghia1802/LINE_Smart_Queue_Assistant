import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandLogo } from '../BrandLogo';

describe('BrandLogo', () => {
  it('renders the shared SVG with an accessible product name', () => {
    render(<BrandLogo />);

    expect(screen.getByRole('img', { name: 'LINE Smart Queue Assistant' })).toHaveAttribute(
      'src',
      '/logo.svg'
    );
  });

  it('can be decorative when adjacent text already names the product', () => {
    const { container } = render(<BrandLogo decorative />);

    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('aria-hidden', 'true');
  });
});
