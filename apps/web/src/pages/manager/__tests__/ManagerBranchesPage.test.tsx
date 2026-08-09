import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../../../i18n';
import { del, get, patch } from '../../../services/apiClient';
import { ManagerBranchesPage } from '../ManagerBranchesPage';

vi.mock('../../../services/apiClient', () => ({
  ApiClientError: class ApiClientError extends Error {},
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

const branch = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Tokyo Station',
  phone: '0312345678',
  email: 'tokyo@example.jp',
  postal_code: '100-0001',
  prefecture: 'Tokyo',
  city: 'Chiyoda',
  address_line1: '1-1 Marunouchi',
  address_line2: null,
  latitude: null,
  longitude: null,
  google_place_id: null,
  formatted_map_address: null,
  manager_count: 0,
  staff_count: 0,
  queue_count: 0,
  queues: [],
  managers: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      displayName: 'First invite',
      email: 'first@example.jp',
      accountStatus: 'invited',
      isOwner: false,
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      displayName: 'Second invite',
      email: 'second@example.jp',
      accountStatus: 'invited',
      isOwner: false,
    },
  ],
};

describe('ManagerBranchesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    vi.mocked(get).mockResolvedValue([branch]);
  });

  it('allows revoking one pending invitation when another invitation remains', async () => {
    vi.mocked(del).mockResolvedValue({ removed: true, invitationRevoked: true });
    renderPage();

    const revokeButtons = await screen.findAllByRole('button', { name: 'Revoke invitation' });
    expect(revokeButtons).toHaveLength(2);
    const firstRevokeButton = revokeButtons[0];
    const firstManager = branch.managers[0];
    if (!firstRevokeButton || !firstManager) throw new Error('Expected pending manager fixtures');
    expect(firstRevokeButton).toBeEnabled();
    fireEvent.click(firstRevokeButton);

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith(`/api/v1/branches/${branch.id}/managers/${firstManager.id}`)
    );
  });

  it('opens the owner edit form and submits the edited branch fields', async () => {
    vi.mocked(patch).mockResolvedValue({ ...branch, name: 'Tokyo Central' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit branch' }));
    const nameInput = screen.getByRole('textbox', { name: 'Branch name' });
    fireEvent.change(nameInput, { target: { value: 'Tokyo Central' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        `/api/v1/branches/${branch.id}`,
        expect.objectContaining({
          name: 'Tokyo Central',
          phone: branch.phone,
          postalCode: branch.postal_code,
        })
      )
    );
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ManagerBranchesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
