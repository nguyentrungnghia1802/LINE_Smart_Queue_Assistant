import { isAxiosError } from 'axios';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitcher } from '../components/i18n/LanguageSwitcher';
import { ApiClientError } from '../services/apiClient';
import { getCustomerLineEntryUrl } from '../services/liff/entryUrl';
import { useAuthStore } from '../store/authStore';

const CUSTOMER_LINE_ENTRY_URL = getCustomerLineEntryUrl('/liff/home');
const LEGACY_CUSTOMER_AUTH_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_CUSTOMER_AUTH === 'true';

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
      <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-lift)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_430px]">
        <section className="hidden bg-[#085463] px-10 py-12 text-white lg:flex lg:items-center lg:justify-center xl:px-14">
          <div className="w-full max-w-[590px] text-center">
            <BrandLogo decorative className="mx-auto h-16 w-16" />
            <h1 className="mt-6 text-4xl font-bold leading-tight">LINE Smart Queue Assistant</h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-gray-300">
              {t('login.intro', { ns: 'auth' })}
            </p>

            <div
              data-testid="login-benefits"
              className="mt-11 grid grid-cols-3 border-y border-white/10 py-6"
            >
              <FeatureHighlight
                title="24h"
                description={t('login.onlineReception', { ns: 'auth' })}
                icon={<ClockIcon />}
                iconClassName="bg-emerald-400/10 text-emerald-300 ring-emerald-300/20"
              />
              <FeatureHighlight
                title="LINE"
                description={t('login.notificationIntegration', { ns: 'auth' })}
                icon={<MessageIcon />}
                iconClassName="bg-[#06C755]/10 text-[#62e794] ring-[#06C755]/25"
                divided
              />
              <FeatureHighlight
                title="JPY"
                description={t('login.paymentDemo', { ns: 'auth' })}
                icon={<PaymentIcon />}
                iconClassName="bg-amber-300/10 text-amber-200 ring-amber-200/20"
                divided
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col justify-center bg-white p-6 sm:p-10 lg:p-11">
          <div className="mb-8">
            <BrandLogo decorative className="h-14 w-14 lg:hidden" />
            <h2 className="mt-5 text-2xl font-bold text-gray-950">
              {t('login.title', { ns: 'auth' })}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t('login.customerLineDescription', { ns: 'auth' })}
            </p>
          </div>

          {CUSTOMER_LINE_ENTRY_URL && (
            <a
              href={CUSTOMER_LINE_ENTRY_URL}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#06C755] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#05b54c] focus:outline-none focus:ring-4 focus:ring-[#06C755]/20"
            >
              <LineIcon />
              {t('login.continueWithLine', { ns: 'auth' })}
            </a>
          )}

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">
              {t('login.operationsDivider', { ns: 'auth' })}
            </span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <p className="mb-4 text-sm text-gray-500">
            {t('login.operationsSubtitle', { ns: 'auth' })}
          </p>

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

            {LEGACY_CUSTOMER_AUTH_ENABLED && (
              <p className="pt-2 text-center text-sm text-gray-500">
                {t('login.legacyCustomerAuth', { ns: 'auth' })}{' '}
                <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
                  {t('login.customerRegister', { ns: 'auth' })}
                </Link>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function FeatureHighlight({
  title,
  description,
  icon,
  iconClassName,
  divided = false,
}: Readonly<{
  title: string;
  description: string;
  icon: ReactNode;
  iconClassName: string;
  divided?: boolean;
}>) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center px-4 ${divided ? 'border-l border-white/10' : ''}`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${iconClassName}`}
      >
        {icon}
      </span>
      <p className="mt-3 text-xl font-bold text-white">{title}</p>
      <p className="mt-1 max-w-32 text-xs leading-5 text-gray-300">{description}</p>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M5 18.5 3.5 21l4-1.2a9 9 0 1 0-2.5-1.3Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="m8 5 4 6 4-6M9 11h6M9 14h6M12 11v8" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M21.7 10.3c0-4.3-4.3-7.8-9.7-7.8S2.3 6 2.3 10.3c0 3.9 3.4 7.1 8.1 7.7.3.1.7.2.8.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1.2 1.1.7 1.3-.6 7.1-4.2 9.6-7.3 1.7-1.8 1.9-3.6 1.9-3.5ZM8.2 12.8H6.3a.5.5 0 0 1-.5-.5V8.5a.5.5 0 0 1 1 0v3.3h1.4a.5.5 0 0 1 0 1Zm1.9-.5a.5.5 0 0 1-1 0V8.5a.5.5 0 0 1 1 0v3.8Zm4.6 0a.5.5 0 0 1-.9.3l-1.9-2.5v2.2a.5.5 0 0 1-1 0V8.5a.5.5 0 0 1 .9-.3l1.9 2.5V8.5a.5.5 0 0 1 1 0v3.8Zm3.1-2.4a.5.5 0 0 1 0 1h-1.4v.9h1.4a.5.5 0 0 1 0 1h-1.9a.5.5 0 0 1-.5-.5V8.5a.5.5 0 0 1 .5-.5h1.9a.5.5 0 0 1 0 1h-1.4v.9h1.4Z" />
    </svg>
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
