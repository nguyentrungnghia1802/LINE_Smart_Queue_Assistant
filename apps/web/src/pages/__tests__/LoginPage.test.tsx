import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from '../../pages/LoginPage';
import { ApiClientError } from '../../services/apiClient';
import { AUTH_SESSION_NOTICE_STORAGE_KEY } from '../../store/authSession';

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

vi.mock('../../services/liff/entryUrl', () => ({
  getCustomerLineEntryUrl: () => 'https://liff.line.me/1234567890-AbCdEfGh/home',
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockGetState.mockReset();
    mockGetState.mockReturnValue({ user: null });
    sessionStorage.clear();
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
    expect(link).toHaveAttribute('href', '/forgot-password');
  });

  it('renders the language switcher on the login page', () => {
    renderPage();

    expect(screen.getByRole('combobox', { name: '言語' })).toBeInTheDocument();
  });

  it('renders the centered product benefits with decorative icons', () => {
    renderPage();

    const benefits = screen.getByTestId('login-benefits');
    expect(benefits).toHaveTextContent('24h');
    expect(benefits).toHaveTextContent('LINE');
    expect(benefits).toHaveTextContent('JPY');
    expect(benefits.querySelectorAll('svg')).toHaveLength(3);
  });

  it('offers LINE as the customer login path and keeps email for business users', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'LINEで受付を始める' })).toHaveAttribute(
      'href',
      'https://liff.line.me/1234567890-AbCdEfGh/home'
    );
    expect(
      screen.getByText('スタッフ、マネージャー、管理者はメールでログインしてください。')
    ).toBeInTheDocument();
  });

  it('shows the business application link on its own line', () => {
    renderPage();

    const prompt = screen.getByText('法人向けサービスの導入をご希望ですか？');
    const link = screen.getByRole('link', { name: '法人申し込みを開始' });
    expect(prompt).toHaveClass('block');
    expect(link).toHaveClass('inline-block');
    expect(link).toHaveAttribute('href', '/business/register');
  });

  it('shows backend message when login fails with ApiClientError message', async () => {
    mockLogin.mockRejectedValueOnce(
      new ApiClientError('UNAUTHORIZED', 401, undefined, 'このアカウントは無効です。')
    );

    renderPage();
    await submitLogin();

    expect(await screen.findByText('このアカウントは無効です。')).toBeInTheDocument();
  });

  it('shows a specific translated message for an incorrect password', async () => {
    mockLogin.mockRejectedValueOnce(
      new ApiClientError('AUTH_INVALID_PASSWORD', 401, undefined, 'The password is incorrect')
    );

    renderPage();
    await submitLogin();

    expect(await screen.findByText('パスワードが正しくありません。')).toBeInTheDocument();
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

  it('shows a friendly localized notice after an expired session redirect', () => {
    sessionStorage.setItem(AUTH_SESSION_NOTICE_STORAGE_KEY, 'AUTH_SESSION_EXPIRED');

    renderPage();

    expect(
      screen.getByText(
        '一定時間操作がなかったため、ログインセッションが終了しました。もう一度ログインしてください。'
      )
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(AUTH_SESSION_NOTICE_STORAGE_KEY)).toBeNull();
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
