import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerDashboardPage } from '../CustomerDashboardPage';

const { mockNavigate, mockGet } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { role: 'customer' },
  }),
}));

vi.mock('../../../services/apiClient', () => ({
  get: mockGet,
}));

describe('CustomerDashboardPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGet.mockReset();
    mockGet.mockResolvedValue([]);
  });

  it('renders the language switcher for customer pages', async () => {
    render(
      <MemoryRouter>
        <CustomerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '言語' })).toBeInTheDocument();
    });
    expect(screen.getByText('現在有効な受付はありません。')).toBeInTheDocument();
  });
});
