import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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
    const heroVideo = screen.getByTestId('marketing-hero-video') as HTMLVideoElement;
    expect(heroVideo.muted).toBe(true);
    expect(heroVideo).toHaveAttribute('loop');
    expect(heroVideo).toHaveAttribute('playsinline');
    expect(heroVideo.querySelector('source')).toHaveAttribute('src', '/vid/banner.mp4');
    expect(
      screen.getByRole('heading', { name: 'さまざまなサービス業にフィット' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'サロン・美容' })).toHaveAttribute(
      'src',
      '/img/solutions/salon.webp'
    );
    expect(screen.getByRole('link', { name: 'support@smartqueue.io.vn' })).toHaveAttribute(
      'href',
      'mailto:support@smartqueue.io.vn'
    );
  });

  it('smoothly scrolls to a selected marketing section', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <MemoryRouter>
        <MarketingHomePage />
      </MemoryRouter>
    );

    const pricingLink = screen.getAllByRole('link', { name: '料金' })[0];
    if (!pricingLink) throw new Error('Pricing navigation link was not rendered');
    fireEvent.click(pricingLink);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});
