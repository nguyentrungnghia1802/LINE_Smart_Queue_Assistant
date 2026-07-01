import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NotFoundPage } from '../../pages/NotFoundPage';

describe('NotFoundPage', () => {
  it('renders 404 text', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders Japanese not found heading', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
  });

  it('renders a link to home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'ホームへ戻る' });
    expect(link).toHaveAttribute('href', '/');
  });
});
