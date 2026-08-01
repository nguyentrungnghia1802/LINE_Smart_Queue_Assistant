import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { StandalonePageTopBar } from '../components/layout/StandalonePageTopBar';
import { ApiClientError } from '../services/apiClient';
import { usersApi } from '../services/users.api';
import { useAuthStore } from '../store/authStore';

export function AccountPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { user, isAuthenticated, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [visibleField, setVisibleField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (passwordChanged) {
    return (
      <main className="min-h-screen bg-gray-50">
        <StandalonePageTopBar contentClassName="max-w-3xl" />
        <div className="mx-auto max-w-3xl px-4 py-8">
          <section className="rounded-lg border border-emerald-200 bg-white p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-2xl font-bold text-gray-950">
              {t('account.changePassword.successTitle', { ns: 'auth' })}
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {t('account.changePassword.successDescription', { ns: 'auth' })}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-gray-950 px-5 text-sm font-bold text-white hover:bg-gray-800"
            >
              {t('account.changePassword.signInAgain', { ns: 'auth' })}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  const canChangePassword = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF].includes(user.role);
  const dashboardPath =
    user.role === UserRole.MANAGER
      ? '/manager'
      : user.role === UserRole.STAFF
        ? '/staff'
        : user.role === UserRole.ADMIN
          ? '/admin'
          : '/liff/home';

  return (
    <main className="min-h-screen bg-gray-50">
      <StandalonePageTopBar contentClassName="max-w-3xl" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('account.title', { ns: 'auth' })}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{t('account.subtitle', { ns: 'auth' })}</p>
          </div>
          <Link
            to={dashboardPath}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            {t('account.back', { ns: 'auth' })}
          </Link>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <dl className="divide-y divide-gray-100">
            <InfoRow label={t('labels.displayName', { ns: 'common' })} value={user.displayName} />
            <InfoRow label={t('labels.email', { ns: 'common' })} value={user.email} />
            <InfoRow label={t('labels.role', { ns: 'common' })} value={user.role} />
            <InfoRow
              label={t('account.organizationId', { ns: 'auth' })}
              value={user.organizationId}
              mono
            />
            <InfoRow label={t('account.userId', { ns: 'auth' })} value={user.id} mono />
          </dl>
        </section>

        {canChangePassword && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  {t('account.changePassword.title', { ns: 'auth' })}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  {t('account.changePassword.description', { ns: 'auth' })}
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handlePasswordChange}>
              <PasswordField
                id="current-password"
                label={t('account.changePassword.currentPassword', { ns: 'auth' })}
                placeholder={t('account.changePassword.currentPasswordPlaceholder', {
                  ns: 'auth',
                })}
                value={currentPassword}
                visible={visibleField === 'current'}
                onChange={setCurrentPassword}
                onToggle={() => setVisibleField(visibleField === 'current' ? null : 'current')}
                showLabel={t('login.showPassword', { ns: 'auth' })}
                hideLabel={t('login.hidePassword', { ns: 'auth' })}
                autoComplete="current-password"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <PasswordField
                  id="new-password"
                  label={t('account.changePassword.newPassword', { ns: 'auth' })}
                  placeholder={t('account.changePassword.newPasswordPlaceholder', { ns: 'auth' })}
                  value={newPassword}
                  visible={visibleField === 'new'}
                  onChange={setNewPassword}
                  onToggle={() => setVisibleField(visibleField === 'new' ? null : 'new')}
                  showLabel={t('login.showPassword', { ns: 'auth' })}
                  hideLabel={t('login.hidePassword', { ns: 'auth' })}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="password-confirmation"
                  label={t('account.changePassword.confirmPassword', { ns: 'auth' })}
                  placeholder={t('account.changePassword.confirmPasswordPlaceholder', {
                    ns: 'auth',
                  })}
                  value={passwordConfirmation}
                  visible={visibleField === 'confirmation'}
                  onChange={setPasswordConfirmation}
                  onToggle={() =>
                    setVisibleField(visibleField === 'confirmation' ? null : 'confirmation')
                  }
                  showLabel={t('login.showPassword', { ns: 'auth' })}
                  hideLabel={t('login.hidePassword', { ns: 'auth' })}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs leading-5 text-gray-500">
                {t('account.changePassword.policy', { ns: 'auth' })}
              </p>
              {error && (
                <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-gray-950 px-5 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isSubmitting
                    ? t('account.changePassword.submitting', { ns: 'auth' })
                    : t('account.changePassword.submit', { ns: 'auth' })}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword !== passwordConfirmation) {
      setError(t('account.changePassword.passwordMismatch', { ns: 'auth' }));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('account.changePassword.passwordMustDiffer', { ns: 'auth' }));
      return;
    }
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError(t('account.changePassword.invalidPolicy', { ns: 'auth' }));
      return;
    }

    setIsSubmitting(true);
    try {
      await usersApi.changePassword({ currentPassword, newPassword, passwordConfirmation });
      setPasswordChanged(true);
      await logout().catch(() => undefined);
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        const key = `errors.${caught.code}`;
        setError(
          t(key, {
            ns: 'common',
            defaultValue: t('account.changePassword.failed', { ns: 'auth' }),
          })
        );
      } else {
        setError(t('account.changePassword.failed', { ns: 'auth' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  visible,
  onChange,
  onToggle,
  showLabel,
  hideLabel,
  autoComplete,
}: Readonly<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  autoComplete: string;
}>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          required
          maxLength={128}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 pr-11 text-sm text-gray-950 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-800"
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value?: string | null; mono?: boolean }>) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className={`break-all text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || '-'}
      </dd>
    </div>
  );
}
