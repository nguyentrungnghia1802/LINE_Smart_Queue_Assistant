import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { LanguageSwitcher } from '../components/i18n/LanguageSwitcher';
import { ApiClientError } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { isAuthenticated, login, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(roleHomePath(user.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // get updated user from store after login
      const updatedUser = useAuthStore.getState().user;
      navigate(updatedUser ? roleHomePath(updatedUser.role) : '/app', { replace: true });
    } catch (err) {
      setError(resolveLoginErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-20">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher compact />
      </div>
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[var(--shadow-soft)] lg:grid-cols-[1fr_420px]">
        <section className="hidden bg-gray-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold">
              LQ
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight">LINE Smart Queue Assistant</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-gray-300">
              {t('login.intro', { ns: 'auth' })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">24h</p>
              <p className="mt-1 text-gray-300">{t('login.onlineReception')}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">LINE</p>
              <p className="mt-1 text-gray-300">{t('login.notificationIntegration')}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">JPY</p>
              <p className="mt-1 text-gray-300">{t('login.paymentDemo')}</p>
            </div>
          </div>
        </section>

        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white lg:hidden">
              LQ
            </div>
            <h2 className="mt-5 text-2xl font-bold text-gray-950">
              {t('login.title', { ns: 'auth' })}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{t('login.subtitle', { ns: 'auth' })}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                {t('labels.email', { ns: 'common' })}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                {t('labels.password', { ns: 'common' })}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 pr-11 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? t('login.hidePassword', { ns: 'auth' })
                      : t('login.showPassword', { ns: 'auth' })
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <a
                  href="#"
                  className="text-sm font-medium text-gray-500 transition hover:text-brand-700"
                >
                  {t('login.forgotPassword', { ns: 'auth' })}
                </a>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gray-950 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? t('login.submitting', { ns: 'auth' }) : t('login.submit', { ns: 'auth' })}
            </button>

            <p className="pt-2 text-center text-sm text-gray-500">
              {t('login.noAccount', { ns: 'auth' })}{' '}
              <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
                {t('login.customerRegister', { ns: 'auth' })}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function resolveLoginErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslation>['t']
): string {
  if (error instanceof ApiClientError) {
    const backendMessage = error.message?.trim();
    if (backendMessage) {
      return backendMessage;
    }
    if (error.status === 401 || error.code === 'UNAUTHORIZED') {
      return t('login.invalid', { ns: 'auth' });
    }
    return t(`errors.${error.code}`, {
      ns: 'common',
      defaultValue:
        error.status && error.status >= 500
          ? t('errors.INTERNAL_ERROR', { ns: 'common' })
          : t('errors.UNKNOWN', { ns: 'common' }),
    });
  }

  if (isAxiosError(error) && !error.response) {
    return t('errors.NETWORK_ERROR', { ns: 'common' });
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return t('errors.UNKNOWN', { ns: 'common' });
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M3 3 21 21" />
      <path d="M10.6 10.7A3 3 0 0 0 14 14" />
      <path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
      <path d="M6.6 6.7C3.8 8.5 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 5-1.2" />
    </svg>
  );
}

function roleHomePath(role: UserRole): string {
  if (role === UserRole.ADMIN) return '/admin';
  if (role === UserRole.MANAGER) return '/manager';
  if (role === UserRole.STAFF) return '/staff';
  if (role === UserRole.CUSTOMER) return '/customer';
  return '/app';
}
