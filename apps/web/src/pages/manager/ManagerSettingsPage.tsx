import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLocale } from '@line-queue/shared';

import { get, patch } from '../../services/apiClient';
import { uploadImage } from '../../services/media.api';
import { useAuthStore } from '../../store/authStore';
import { compressLogoFile } from '../../utils/compressLogoFile';
import {
  type ApiFieldErrors,
  firstFieldError,
  getApiFieldErrors,
  INPUT_LIMITS,
} from '../../utils/formValidation';

interface OrgInfo {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  defaultLocale: SupportedLocale;
}

export function ManagerSettingsPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    logoUrl: '',
    phone: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    defaultLocale: 'ja' as SupportedLocale,
  });
  const organization = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get('/api/v1/orgs/my-org'),
  });

  useEffect(() => {
    if (!organization.data) return;
    const org = organization.data;
    setForm({
      name: org.name,
      logoUrl: org.logoUrl ?? '',
      phone: org.phone ?? '',
      postalCode: org.postalCode ?? '',
      prefecture: org.prefecture ?? '',
      city: org.city ?? '',
      addressLine1: org.addressLine1 ?? '',
      addressLine2: org.addressLine2 ?? '',
      defaultLocale: org.defaultLocale ?? 'ja',
    });
  }, [organization.data]);

  const profileMutation = useMutation({
    mutationFn: () =>
      patch<{ displayName: string; email: string }>('/api/v1/users/me', { displayName }),
    onSuccess: (updated) => {
      if (user) setUser({ ...user, displayName: updated.displayName, email: updated.email });
      setFeedback(t('settings.saved'));
      setFeedbackIsError(false);
      setFieldErrors({});
    },
    onError: (error) => {
      setFieldErrors(getApiFieldErrors(error));
      setFeedback(error instanceof Error ? error.message : t('settings.saveFailed'));
      setFeedbackIsError(true);
    },
  });
  const organizationMutation = useMutation({
    mutationFn: () =>
      patch('/api/v1/orgs/my-org', {
        name: form.name,
        logoUrl: form.logoUrl || null,
        phone: form.phone || null,
        postalCode: form.postalCode || null,
        prefecture: form.prefecture || null,
        city: form.city || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        defaultLocale: form.defaultLocale,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager-my-org'] });
      setFeedback(t('settings.saved'));
      setFeedbackIsError(false);
      setFieldErrors({});
    },
    onError: (error) => {
      setFieldErrors(getApiFieldErrors(error));
      setFeedback(error instanceof Error ? error.message : t('settings.saveFailed'));
      setFeedbackIsError(true);
    },
  });

  async function uploadLogo(file?: File) {
    if (!file) return;
    setLogoBusy(true);
    setFeedback('');
    setFeedbackIsError(false);
    try {
      const asset = await uploadImage(await compressLogoFile(file), 'organization_logo');
      setForm((current) => ({ ...current, logoUrl: asset.public_url }));
      setFeedback(t('settings.logoUploaded'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t('settings.uploadFailed'));
      setFeedbackIsError(true);
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase text-brand-700">{t('settings.section')}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('settings.ownerScopeHint')}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          profileMutation.mutate();
        }}
        className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
      >
        <h2 className="font-bold text-gray-950">{t('settings.personalInfo')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label={t('labels.displayName', { ns: 'common' })}
            htmlFor="manager-display-name"
            error={firstFieldError(fieldErrors, 'displayName')}
          >
            <input
              id="manager-display-name"
              name="displayName"
              required
              minLength={1}
              maxLength={INPUT_LIMITS.displayName}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('settings.placeholders.displayName')}
              className={inputClass}
            />
          </Field>
          <Field label={t('labels.email', { ns: 'common' })} htmlFor="manager-email">
            <input
              id="manager-email"
              name="email"
              disabled
              value={user?.email ?? ''}
              className={`${inputClass} bg-gray-50`}
            />
          </Field>
        </div>
        <button className={buttonClass} disabled={profileMutation.isPending}>
          {t('actions.save', { ns: 'common' })}
        </button>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          organizationMutation.mutate();
        }}
        className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
      >
        <h2 className="font-bold text-gray-950">{t('settings.organizationInfo')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label={t('settings.organizationName')}
            htmlFor="organization-name"
            error={firstFieldError(fieldErrors, 'name')}
          >
            <input
              id="organization-name"
              name="name"
              required
              minLength={1}
              maxLength={INPUT_LIMITS.organizationName}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t('settings.placeholders.organizationName')}
              className={inputClass}
            />
          </Field>
          <Field label={t('settings.defaultLocale')} htmlFor="organization-locale">
            <select
              id="organization-locale"
              name="defaultLocale"
              value={form.defaultLocale}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultLocale: event.target.value as SupportedLocale,
                }))
              }
              className={inputClass}
            >
              <option value="ja">{t('language.ja', { ns: 'common' })}</option>
              <option value="vi">{t('language.vi', { ns: 'common' })}</option>
              <option value="en">{t('language.en', { ns: 'common' })}</option>
            </select>
          </Field>
          <Field
            label={t('labels.phone', { ns: 'common' })}
            htmlFor="organization-phone"
            error={firstFieldError(fieldErrors, 'phone')}
          >
            <input
              id="organization-phone"
              name="phone"
              type="tel"
              maxLength={INPUT_LIMITS.phone}
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder={t('settings.placeholders.phone')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('settings.postalCode')}
            htmlFor="organization-postal-code"
            error={firstFieldError(fieldErrors, 'postalCode')}
          >
            <input
              id="organization-postal-code"
              name="postalCode"
              inputMode="numeric"
              maxLength={INPUT_LIMITS.postalCode}
              pattern="[0-9]{3}-?[0-9]{4}"
              value={form.postalCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, postalCode: event.target.value }))
              }
              placeholder="100-0001"
              className={inputClass}
            />
          </Field>
          {(['prefecture', 'city', 'addressLine1', 'addressLine2'] as const).map((key) => (
            <Field
              key={key}
              label={t(`settings.${key}`)}
              htmlFor={`organization-${key}`}
              error={firstFieldError(fieldErrors, key)}
            >
              <input
                id={`organization-${key}`}
                name={key}
                maxLength={
                  key === 'prefecture'
                    ? INPUT_LIMITS.prefecture
                    : key === 'city'
                      ? INPUT_LIMITS.city
                      : INPUT_LIMITS.addressLine
                }
                value={form[key]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [key]: event.target.value }))
                }
                placeholder={t(`settings.placeholders.${key}`)}
                className={inputClass}
              />
            </Field>
          ))}
          <Field label={t('settings.organizationLogo')} wide>
            <div className="flex items-center gap-4">
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt={t('settings.logoAlt')}
                  className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                />
              )}
              <input
                ref={logoInputRef}
                type="file"
                id="organization-logo"
                name="organizationLogo"
                accept="image/png,image/jpeg,image/webp"
                disabled={logoBusy}
                onChange={(event) => void uploadLogo(event.target.files?.[0])}
                className="sr-only"
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={logoBusy}
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {logoBusy ? t('settings.processingImage') : t('settings.chooseLogo')}
                </button>
                <p className="mt-2 truncate text-xs text-gray-500">
                  {form.logoUrl ? t('settings.logoUploaded') : t('settings.logoNotSelected')}
                </p>
              </div>
            </div>
          </Field>
        </div>
        <button className={buttonClass} disabled={organizationMutation.isPending || logoBusy}>
          {t('actions.save', { ns: 'common' })}
        </button>
      </form>
      {feedback && (
        <p
          role={feedbackIsError ? 'alert' : 'status'}
          className={`text-sm font-medium ${feedbackIsError ? 'text-red-700' : 'text-gray-700'}`}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm';
const buttonClass =
  'mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50';

function Field({
  label,
  children,
  wide = false,
  htmlFor,
  error,
}: Readonly<{
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  htmlFor?: string;
  error?: string;
}>) {
  return (
    <div className={`text-sm font-medium text-gray-700 ${wide ? 'sm:col-span-2' : ''}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      {children}
      {error && (
        <p className="mt-1 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
