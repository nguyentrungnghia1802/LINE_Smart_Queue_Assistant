import { CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitcher } from '../components/i18n/LanguageSwitcher';
import { get, post } from '../services/apiClient';

type Context = {
  displayName: string;
  maskedEmail: string;
  organizationName: string | null;
};

export function AccountLifecyclePage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const mode = location.pathname.includes('activate-account')
    ? 'activate'
    : location.pathname.includes('reset-password')
      ? 'reset'
      : 'forgot';
  const [context, setContext] = useState<Context | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (mode === 'forgot' || !token) return;
    void get<Context>(`/api/v1/auth/account-action?token=${encodeURIComponent(token)}`)
      .then(setContext)
      .catch((cause: { message?: string }) =>
        setError(cause.message ?? t('lifecycle.invalidLink'))
      );
  }, [mode, t, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (mode === 'forgot') {
        await post('/api/v1/auth/forgot-password', { email });
      } else {
        await post(`/api/v1/auth/${mode === 'activate' ? 'activate-account' : 'reset-password'}`, {
          token,
          password,
          passwordConfirmation: confirmation,
        });
      }
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('lifecycle.failed'));
    }
  }

  return (
    <main className="min-h-dvh bg-gray-100 px-4 py-8 sm:flex sm:items-center sm:justify-center">
      <section className="mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between">
          <BrandLogo className="h-10 w-10" />
          <LanguageSwitcher />
        </div>
        <div className="mt-8">
          {done ? (
            <CheckCircle2 className="h-9 w-9 text-brand-600" />
          ) : mode === 'forgot' ? (
            <Mail className="h-9 w-9 text-brand-600" />
          ) : (
            <KeyRound className="h-9 w-9 text-brand-600" />
          )}
          <h1 className="mt-4 text-2xl font-bold text-gray-950">{t(`lifecycle.${mode}.title`)}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {done
              ? t(`lifecycle.${mode}.success`)
              : context
                ? t('lifecycle.context', {
                    name: context.displayName,
                    email: context.maskedEmail,
                    organization: context.organizationName ?? '',
                  })
                : t(`lifecycle.${mode}.description`)}
          </p>
        </div>
        {!done && (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === 'forgot' ? (
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-3"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('lifecycle.email')}
              />
            ) : (
              <>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('lifecycle.password')}
                />
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                  type="password"
                  required
                  minLength={10}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={t('lifecycle.confirmPassword')}
                />
              </>
            )}
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button
              className="w-full rounded-lg bg-gray-950 px-4 py-3 font-bold text-white"
              type="submit"
            >
              {t(`lifecycle.${mode}.submit`)}
            </button>
          </form>
        )}
        <Link className="mt-6 block text-center text-sm font-semibold text-brand-700" to="/login">
          {t('lifecycle.back')}
        </Link>
      </section>
    </main>
  );
}
