import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from '../../pages/LoginPage';
import { ApiClientError } from '../../services/apiClient';

const { mockNavigate, mockLogin, mockGetState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
  mockGetState: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: Object.assign(
    () => ({
      isAuthenticated: false,
      login: mockLogin,
      user: null,
    }),
    { getState: mockGetState }
  ),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockGetState.mockReset();
    mockGetState.mockReturnValue({ user: null });
  });

  it('toggles password visibility', () => {
    renderPage();

    const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: 'パスワードを表示' });

    expect(passwordInput.type).toBe('password');

    fireEvent.click(toggleButton);

    expect(passwordInput.type).toBe('text');
    expect(screen.getByRole('button', { name: 'パスワードを非表示' })).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    renderPage();

    const link = screen.getByRole('link', { name: 'パスワードをお忘れですか？' });
    expect(link).toHaveAttribute('href', '#');
  });

  it('shows backend message when login fails with ApiClientError message', async () => {
    mockLogin.mockRejectedValueOnce(
      new ApiClientError('UNAUTHORIZED', 401, undefined, 'このアカウントは無効です。')
    );

    renderPage();
    await submitLogin();

    expect(await screen.findByText('このアカウントは無効です。')).toBeInTheDocument();
  });

  it('shows network fallback when request cannot reach the server', async () => {
    mockLogin.mockRejectedValueOnce(
      new AxiosError('Network Error', 'ERR_NETWORK', undefined, undefined, undefined)
    );

    renderPage();
    await submitLogin();

    expect(
      await screen.findByText('APIサーバーに接続できません。しばらくしてからお試しください。')
    ).toBeInTheDocument();
  });

  it('shows translated validation fallback when backend message is absent', async () => {
    mockLogin.mockRejectedValueOnce(new ApiClientError('VALIDATION_ERROR', 422));

    renderPage();
    await submitLogin();

    expect(await screen.findByText('入力内容を確認してください。')).toBeInTheDocument();
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

async function submitLogin() {
  fireEvent.change(screen.getByLabelText('メール'), { target: { value: 'staff@example.com' } });
  fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('staff@example.com', 'password123'));
}
