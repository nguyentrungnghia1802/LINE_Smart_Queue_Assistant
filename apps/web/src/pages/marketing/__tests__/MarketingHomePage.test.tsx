import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MarketingHomePage } from '../MarketingHomePage';

describe('MarketingHomePage', () => {
  it('uses the public root as a product site with business onboarding CTA', () => {
    render(
      <MemoryRouter>
        <MarketingHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Smart Queue Assistant' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '法人向けに導入する' })[0]).toHaveAttribute(
      'href',
      '/business/register'
    );
    expect(screen.getByText('LINEファースト')).toBeInTheDocument();
  });
});
