import { ArrowLeft, Check, Eye, EyeOff, ImagePlus, ShieldCheck } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import type { SupportedLocale } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { BrandLogo } from '../../components/BrandLogo';
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { ApiClientError, post } from '../../services/apiClient';
import { compressLogoFile } from '../../utils/compressLogoFile';

type PlanCode = 'starter' | 'standard' | 'scale';
type BillingCycle = 'monthly' | 'annual';
type FormState = {
  legalName: string;
  tradeName: string;
  businessType: string;
  registrationNumber: string;
  websiteUrl: string;
  contactName: string;
  contactTitle: string;
  workEmail: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  locationCount: string;
  expectedMonthlyCustomers: string;
  planCode: PlanCode;
  billingCycle: BillingCycle;
  defaultLocale: SupportedLocale;
  logoUrl: string;
  password: string;
  termsAccepted: boolean;
};

type SubmissionResult = {
  referenceCode: string;
  paymentStatus: string;
  amountYen: number;
};

const PLAN_PRICES = { starter: 9_800, standard: 29_800, scale: 59_800 } as const;
const VALID_PLANS: PlanCode[] = ['starter', 'standard', 'scale'];

export function BusinessRegistrationPage() {
  const { t, i18n } = useTranslation(['marketing', 'common']);
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') as PlanCode | null;
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [form, setForm] = useState<FormState>({
    legalName: '',
    tradeName: '',
    businessType: 'salon',
    registrationNumber: '',
    websiteUrl: '',
    contactName: '',
    contactTitle: '',
    workEmail: '',
    phone: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    locationCount: '1',
    expectedMonthlyCustomers: '500',
    planCode: requestedPlan && VALID_PLANS.includes(requestedPlan) ? requestedPlan : 'standard',
    billingCycle: 'monthly',
    defaultLocale: ((i18n.resolvedLanguage ?? 'ja').split('-')[0] as SupportedLocale) || 'ja',
    logoUrl: '',
    password: '',
    termsAccepted: false,
  });

  const amountYen = useMemo(() => {
    const monthly = PLAN_PRICES[form.planCode];
    return form.billingCycle === 'annual' ? monthly * 10 : monthly;
  }, [form.billingCycle, form.planCode]);
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ja', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }),
    [i18n.resolvedLanguage]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function nextStep() {
    if (!formRef.current?.reportValidity()) return;
    setError('');
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLogo(file?: File) {
    if (!file) return;
    setIsCompressing(true);
    setError('');
    try {
      update('logoUrl', await compressLogoFile(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('registration.imageFailed'));
    } finally {
      setIsCompressing(false);
    }
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    setIsSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const submitted = await post<SubmissionResult>(
        `${API_BASE_PATH}/organization-applications`,
        {
          ...form,
          registrationNumber: form.registrationNumber.trim() || null,
          websiteUrl: form.websiteUrl.trim() || null,
          contactTitle: form.contactTitle.trim() || null,
          addressLine2: form.addressLine2.trim() || null,
          logoUrl: form.logoUrl || null,
          locationCount: Number(form.locationCount),
          expectedMonthlyCustomers: Number(form.expectedMonthlyCustomers),
        },
        { headers: { 'X-Skip-Auth-Redirect': 'true' } }
      );
      setResult(submitted);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      if (submitError instanceof ApiClientError) {
        const details = submitError.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        setFieldErrors(details?.fieldErrors ?? {});
        setError(submitError.message);
      } else {
        setError(t('registration.failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Check className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-6 text-sm font-bold uppercase text-brand-700">
            {t('registration.success.eyebrow')}
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t('registration.success.title')}</h1>
          <p className="mt-4 max-w-xl leading-7 text-gray-600">
            {t('registration.success.description')}
          </p>
          <div className="mt-8 grid w-full gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-2">
            <div className="bg-white p-5">
              <p className="text-xs font-bold uppercase text-gray-500">
                {t('registration.success.reference')}
              </p>
              <p className="mt-2 font-mono text-xl font-bold">{result.referenceCode}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-bold uppercase text-gray-500">
                {t('registration.success.payment')}
              </p>
              <p className="mt-2 text-xl font-bold text-brand-700">
                {currency.format(result.amountYen)}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="rounded-md bg-gray-950 px-5 py-3 text-sm font-bold text-white hover:bg-gray-800"
            >
              {t('registration.success.home')}
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-gray-300 px-5 py-3 text-sm font-bold hover:bg-white"
            >
              {t('registration.success.login')}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('registration.back')}
        </Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-sm font-bold uppercase text-brand-700">{t('registration.eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t('registration.title')}</h1>
          <p className="mt-3 leading-7 text-gray-600">{t('registration.description')}</p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            ref={formRef}
            onSubmit={(event) => void submitApplication(event)}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
              <p className="text-xs font-bold text-gray-500">
                {t('registration.step', { current: step, total: 3 })}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['business', 'plan', 'review'] as const).map((item, index) => (
                  <div key={item}>
                    <div
                      className={`h-1 rounded ${step >= index + 1 ? 'bg-brand-600' : 'bg-gray-200'}`}
                    />
                    <p
                      className={`mt-2 text-xs font-semibold ${step === index + 1 ? 'text-gray-950' : 'text-gray-500'}`}
                    >
                      {t(`registration.steps.${item}`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-7">
                {error}
              </div>
            )}

            <fieldset disabled={step !== 1} className={step === 1 ? 'block' : 'hidden'}>
              <FormSection title={t('registration.sections.company')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('registration.fields.legalName')}
                    name="legalName"
                    value={form.legalName}
                    onChange={(value) => update('legalName', value)}
                    error={fieldErrors['legalName']?.[0]}
                    required
                  />
                  <Field
                    label={t('registration.fields.tradeName')}
                    name="tradeName"
                    value={form.tradeName}
                    onChange={(value) => update('tradeName', value)}
                    error={fieldErrors['tradeName']?.[0]}
                    required
                  />
                  <SelectField
                    label={t('registration.fields.businessType')}
                    name="businessType"
                    value={form.businessType}
                    onChange={(value) => update('businessType', value)}
                    options={[
                      'restaurant',
                      'salon',
                      'clinic',
                      'retail',
                      'public_service',
                      'other',
                    ].map((value) => ({ value, label: t(`registration.businessTypes.${value}`) }))}
                  />
                  <Field
                    label={t('registration.fields.registrationNumber')}
                    name="registrationNumber"
                    value={form.registrationNumber}
                    onChange={(value) => update('registrationNumber', value)}
                  />
                  <Field
                    className="sm:col-span-2"
                    label={t('registration.fields.websiteUrl')}
                    name="websiteUrl"
                    type="url"
                    value={form.websiteUrl}
                    onChange={(value) => update('websiteUrl', value)}
                    placeholder="https://"
                    error={fieldErrors['websiteUrl']?.[0]}
                  />
                </div>
              </FormSection>
              <FormSection title={t('registration.sections.contact')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('registration.fields.contactName')}
                    name="contactName"
                    value={form.contactName}
                    onChange={(value) => update('contactName', value)}
                    required
                  />
                  <Field
                    label={t('registration.fields.contactTitle')}
                    name="contactTitle"
                    value={form.contactTitle}
                    onChange={(value) => update('contactTitle', value)}
                  />
                  <Field
                    label={t('registration.fields.workEmail')}
                    name="workEmail"
                    type="email"
                    value={form.workEmail}
                    onChange={(value) => update('workEmail', value)}
                    hint={t('registration.hints.workEmail')}
                    error={fieldErrors['workEmail']?.[0]}
                    required
                  />
                  <Field
                    label={t('registration.fields.phone')}
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(value) => update('phone', value)}
                    placeholder="03-1234-5678"
                    pattern="[0-9+() -]{10,20}"
                    error={fieldErrors['phone']?.[0]}
                    required
                  />
                </div>
              </FormSection>
              <FormSection title={t('registration.sections.address')} last>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('registration.fields.postalCode')}
                    name="postalCode"
                    value={form.postalCode}
                    onChange={(value) => update('postalCode', value)}
                    pattern="[0-9]{3}-?[0-9]{4}"
                    placeholder="100-0001"
                    required
                  />
                  <Field
                    label={t('registration.fields.prefecture')}
                    name="prefecture"
                    value={form.prefecture}
                    onChange={(value) => update('prefecture', value)}
                    required
                  />
                  <Field
                    label={t('registration.fields.city')}
                    name="city"
                    value={form.city}
                    onChange={(value) => update('city', value)}
                    required
                  />
                  <Field
                    label={t('registration.fields.addressLine1')}
                    name="addressLine1"
                    value={form.addressLine1}
                    onChange={(value) => update('addressLine1', value)}
                    required
                  />
                  <Field
                    className="sm:col-span-2"
                    label={t('registration.fields.addressLine2')}
                    name="addressLine2"
                    value={form.addressLine2}
                    onChange={(value) => update('addressLine2', value)}
                  />
                </div>
              </FormSection>
            </fieldset>

            <fieldset disabled={step !== 2} className={step === 2 ? 'block' : 'hidden'}>
              <FormSection title={t('registration.sections.usage')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('registration.fields.locationCount')}
                    name="locationCount"
                    type="number"
                    min="1"
                    max="10000"
                    value={form.locationCount}
                    onChange={(value) => update('locationCount', value)}
                    required
                  />
                  <Field
                    label={t('registration.fields.expectedMonthlyCustomers')}
                    name="expectedMonthlyCustomers"
                    type="number"
                    min="1"
                    max="10000000"
                    value={form.expectedMonthlyCustomers}
                    onChange={(value) => update('expectedMonthlyCustomers', value)}
                    required
                  />
                  <SelectField
                    label={t('registration.fields.defaultLocale')}
                    name="defaultLocale"
                    value={form.defaultLocale}
                    onChange={(value) => update('defaultLocale', value as SupportedLocale)}
                    options={[
                      { value: 'ja', label: t('language.ja', { ns: 'common' }) },
                      { value: 'vi', label: t('language.vi', { ns: 'common' }) },
                      { value: 'en', label: t('language.en', { ns: 'common' }) },
                    ]}
                  />
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {VALID_PLANS.map((plan) => (
                    <label
                      key={plan}
                      className={`cursor-pointer rounded-lg border p-4 ${form.planCode === plan ? 'border-brand-600 bg-brand-50' : 'border-gray-200'}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="planCode"
                        value={plan}
                        checked={form.planCode === plan}
                        onChange={() => update('planCode', plan)}
                      />
                      <span className="font-bold">{t(`pricing.${plan}.name`)}</span>
                      <span className="mt-2 block text-lg font-bold">
                        {currency.format(PLAN_PRICES[plan])}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
                    <label
                      key={cycle}
                      className={`cursor-pointer rounded-md border px-4 py-2 text-sm font-semibold ${form.billingCycle === cycle ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300'}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="billingCycle"
                        value={cycle}
                        checked={form.billingCycle === cycle}
                        onChange={() => update('billingCycle', cycle)}
                      />
                      {t(`pricing.${cycle}`)}
                    </label>
                  ))}
                </div>
              </FormSection>
              <FormSection title={t('registration.sections.account')}>
                <div className="relative">
                  <Field
                    label={t('registration.fields.password')}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    minLength={10}
                    value={form.password}
                    onChange={(value) => update('password', value)}
                    hint={t('registration.hints.password')}
                    error={fieldErrors['password']?.[0]}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-8 flex h-8 w-8 items-center justify-center text-gray-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormSection>
              <FormSection title={t('registration.sections.logo')} last>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-7 w-7 text-gray-400" />
                    )}
                  </div>
                  <label className="block flex-1">
                    <input
                      type="file"
                      name="logo"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => void handleLogo(event.target.files?.[0])}
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-950 file:px-3 file:py-2 file:font-semibold file:text-white"
                    />
                    <span className="mt-2 block text-xs text-gray-500">
                      {isCompressing
                        ? t('organizations.compressingImage', { ns: 'admin' })
                        : t('registration.hints.logo')}
                    </span>
                  </label>
                </div>
              </FormSection>
            </fieldset>

            <fieldset disabled={step !== 3} className={step === 3 ? 'block' : 'hidden'}>
              <FormSection title={t('registration.sections.payment')} last>
                <div className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>{t('registration.demoPayment')}</p>
                </div>
                <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                  <SummaryRow label={t('registration.fields.legalName')} value={form.legalName} />
                  <SummaryRow label={t('registration.fields.tradeName')} value={form.tradeName} />
                  <SummaryRow label={t('registration.fields.workEmail')} value={form.workEmail} />
                  <SummaryRow
                    label={t('registration.fields.locationCount')}
                    value={form.locationCount}
                  />
                  <SummaryRow
                    label={t('registration.total')}
                    value={currency.format(amountYen)}
                    strong
                  />
                </dl>
                <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-gray-700">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={form.termsAccepted}
                    onChange={(event) => update('termsAccepted', event.target.checked)}
                    required
                    className="mt-1 h-4 w-4 accent-brand-600"
                  />
                  {t('registration.terms')}
                </label>
              </FormSection>
            </fieldset>

            <div className="flex items-center justify-between border-t border-gray-200 px-5 py-5 sm:px-7">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-50"
                >
                  {t('registration.previous')}
                </button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isCompressing}
                  className="rounded-md bg-gray-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {t('registration.next')}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !form.termsAccepted}
                  className="rounded-md bg-line-green px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {isSubmitting ? t('registration.submitting') : t('registration.submit')}
                </button>
              )}
            </div>
          </form>

          <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase text-gray-500">{t('registration.summary')}</p>
            <p className="mt-3 text-xl font-bold">{t(`pricing.${form.planCode}.name`)}</p>
            <p className="mt-1 text-sm text-gray-600">
              {t(`pricing.${form.planCode}.description`)}
            </p>
            <div className="mt-6 border-t border-gray-200 pt-5">
              <p className="text-sm text-gray-500">{t(`pricing.${form.billingCycle}`)}</p>
              <p className="mt-1 text-3xl font-bold">{currency.format(amountYen)}</p>
              {form.billingCycle === 'monthly' && (
                <p className="text-sm text-gray-500">{t('pricing.perMonth')}</p>
              )}
            </div>
            <ul className="mt-6 space-y-3">
              {(t(`pricing.${form.planCode}.features`, { returnObjects: true }) as string[]).map(
                (feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {feature}
                  </li>
                )
              )}
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <BrandLogo className="h-9 w-9" />
          <span className="truncate font-bold">Smart Queue Assistant</span>
        </Link>
        <div className="ml-auto">
          <LanguageSwitcher compact />
        </div>
      </div>
    </header>
  );
}

function FormSection({
  title,
  children,
  last = false,
}: Readonly<{ title: string; children: React.ReactNode; last?: boolean }>) {
  return (
    <section className={`px-5 py-6 sm:px-7 ${last ? '' : 'border-b border-gray-200'}`}>
      <h2 className="mb-5 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  pattern?: string;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
  minLength?: number;
};

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  hint,
  error,
  required,
  pattern,
  placeholder,
  className = '',
  min,
  max,
  minLength,
}: Readonly<FieldProps>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        pattern={pattern}
        placeholder={placeholder}
        min={min}
        max={max}
        minLength={minLength}
        aria-invalid={Boolean(error)}
        className={`h-11 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'}`}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs leading-5 text-gray-500">{hint}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className={strong ? 'text-lg font-bold' : 'text-right font-semibold'}>{value}</dd>
    </div>
  );
}
