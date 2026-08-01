import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '@line-queue/shared';

import { ApiClientError } from '../../services/apiClient';
import { AccountPage } from '../AccountPage';

const { mockChangePassword, mockLogout } = vi.hoisted(() => ({
  mockChangePassword: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock('../../services/users.api', () => ({
  usersApi: { changePassword: mockChangePassword },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      displayName: 'Admin Demo',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    },
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

describe('AccountPage password change', () => {
  beforeEach(() => {
    mockChangePassword.mockReset();
    mockLogout.mockReset();
    mockLogout.mockResolvedValue(undefined);
  });

  it('validates password confirmation before sending a request', async () => {
    renderPage();

    fillPasswordForm('Current1234', 'Replacement5678', 'Different5678');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('新しいパスワードが一致しません。');
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('changes the password, signs out all sessions, and shows the re-login action', async () => {
    mockChangePassword.mockResolvedValue({ changed: true });
    renderPage();

    fillPasswordForm('Current1234', 'Replacement5678', 'Replacement5678');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'Current1234',
        newPassword: 'Replacement5678',
        passwordConfirmation: 'Replacement5678',
      })
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('パスワードを変更しました')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新しいパスワードでログイン' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('shows a translated stable error code for an incorrect current password', async () => {
    mockChangePassword.mockRejectedValue(
      new ApiClientError('AUTH_INVALID_PASSWORD', 401, undefined, 'Backend message')
    );
    renderPage();

    fillPasswordForm('Wrong12345', 'Replacement5678', 'Replacement5678');
    fireEvent.click(screen.getByRole('button', { name: 'パスワードを変更' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードが正しくありません。');
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );
}

function fillPasswordForm(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('現在のパスワード'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), {
    target: { value: confirmation },
  });
}
