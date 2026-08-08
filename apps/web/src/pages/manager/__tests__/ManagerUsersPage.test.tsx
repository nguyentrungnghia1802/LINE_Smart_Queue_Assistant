import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { get, post } from '../../../services/apiClient';
import { useAuthStore } from '../../../store/authStore';
import { ManagerUsersPage } from '../ManagerUsersPage';

vi.mock('../../../services/apiClient', () => ({
  del: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

const queue = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '受付キューA',
  status: 'open',
  currentNumber: 0,
  organizationId: 'org-id',
  waitingCount: 0,
  calledCount: 0,
  servingCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ManagerUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'manager-id',
        role: UserRole.MANAGER,
        organizationId: 'org-id',
        branchIds: ['branch-id'],
        isOrganizationOwner: false,
      },
      token: 'token',
      isAuthenticated: true,
    });
    vi.mocked(get).mockImplementation(async (url: string) =>
      url.startsWith('/api/v1/users') ? [] : [queue]
    );
    vi.mocked(post).mockResolvedValue({});
  });

  it('requires and submits one queue assignment when inviting staff', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /スタッフを追加/ }));
    const values: Record<string, string> = {
      displayName: '山田 太郎',
      email: 'staff@example.jp',
      phone: '09012345678',
      currentAddress: '東京都千代田区1-1',
      jobTitle: '受付担当',
      employeeCode: 'ST-001',
    };
    for (const [name, value] of Object.entries(values)) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!input) throw new Error(`Missing ${name} input`);
      fireEvent.change(input, { target: { value } });
    }
    fireEvent.change(screen.getByRole('combobox', { name: '担当キュー *' }), {
      target: { value: queue.id },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/v1/users/staff', {
        ...values,
        queueId: queue.id,
      })
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
        <ManagerUsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
