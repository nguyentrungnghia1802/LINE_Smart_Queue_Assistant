import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock3, Search, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_BASE_PATH, NUMERIC_LIMITS } from '@line-queue/shared';

import { BoundedNumberInput } from '../../components/ui/BoundedNumberInput';
import { Pagination } from '../../components/ui/Pagination';
import { ApiClientError, get, patch, post } from '../../services/apiClient';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = ApplicationStatus | 'all';

type OrganizationApplication = {
  id: string;
  reference_code: string;
  status: ApplicationStatus;
  legal_name: string;
  trade_name: string;
  business_type: string;
  registration_number: string | null;
  website_url: string | null;
  contact_name: string;
  contact_title: string | null;
  work_email: string;
  phone: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  location_count: number;
  expected_monthly_customers: number;
  plan_code: 'starter' | 'standard' | 'scale';
  billing_cycle: 'monthly' | 'annual';
  default_locale: 'ja' | 'vi' | 'en';
  logo_url: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount_yen: number;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export function AdminOrganizationApplicationsPage() {
  const { t, i18n } = useTranslation(['admin', 'marketing', 'common']);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [selected, setSelected] = useState<OrganizationApplication | null>(null);
  const [draft, setDraft] = useState<OrganizationApplication | null>(null);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ja', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.resolvedLanguage]
  );
  const currency = useMemo(
    () =>
      new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ja', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }),
    [i18n.resolvedLanguage]
  );

  const applicationsQuery = useQuery<OrganizationApplication[]>({
    queryKey: ['organization-applications', filter],
    queryFn: () =>
      get<OrganizationApplication[]>(`${API_BASE_PATH}/organization-applications?status=${filter}`),
  });

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      post(`${API_BASE_PATH}/organization-applications/${selected?.id ?? ''}/${action}`, {
        note: note.trim() || null,
      }),
    onSuccess: async (_data, action) => {
      setFeedback(
        action === 'approve' ? t('applications.approveSuccess') : t('applications.rejectSuccess')
      );
      setSelected(null);
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organization-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-orgs'] }),
      ]);
    },
    onError: (error) => {
      setFeedback(error instanceof ApiClientError ? error.message : t('applications.actionFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('Application draft is unavailable');
      return patch<OrganizationApplication>(
        `${API_BASE_PATH}/organization-applications/${draft.id}`,
        {
          legalName: draft.legal_name,
          tradeName: draft.trade_name,
          businessType: draft.business_type,
          registrationNumber: draft.registration_number,
          websiteUrl: draft.website_url,
          contactName: draft.contact_name,
          contactTitle: draft.contact_title,
          workEmail: draft.work_email,
          phone: draft.phone,
          postalCode: draft.postal_code,
          prefecture: draft.prefecture,
          city: draft.city,
          addressLine1: draft.address_line1,
          addressLine2: draft.address_line2,
          locationCount: draft.location_count,
          expectedMonthlyCustomers: draft.expected_monthly_customers,
          planCode: draft.plan_code,
          billingCycle: draft.billing_cycle,
          defaultLocale: draft.default_locale,
          logoUrl: draft.logo_url,
        }
      );
    },
    onSuccess: async (application) => {
      setSelected(application);
      setDraft(application);
      setFeedback(t('applications.updateSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['organization-applications'] });
    },
    onError: (error) => {
      setFeedback(error instanceof ApiClientError ? error.message : t('applications.updateFailed'));
    },
  });

  function openReview(application: OrganizationApplication) {
    setSelected(application);
    setDraft(application);
    setNote(application.review_note ?? '');
    setFeedback('');
  }

  function review(action: 'approve' | 'reject') {
    const confirmation =
      action === 'approve' ? t('applications.approveConfirm') : t('applications.rejectConfirm');
    if (!window.confirm(confirmation)) return;
    reviewMutation.mutate(action);
  }

  const applications = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (applicationsQuery.data ?? []).filter(
      (application) =>
        !query ||
        application.trade_name.toLocaleLowerCase().includes(query) ||
        application.legal_name.toLocaleLowerCase().includes(query) ||
        application.reference_code.toLocaleLowerCase().includes(query) ||
        application.work_email.toLocaleLowerCase().includes(query)
    );
  }, [applicationsQuery.data, search]);
  const pageApplications = applications.slice((page - 1) * 15, page * 15);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase text-brand-700">{t('applications.nav')}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('applications.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          {t('applications.description')}
        </p>
      </div>

      {feedback && (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('applications.title')}>
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setFilter(status);
              setPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm font-bold ${
              filter === status
                ? 'bg-gray-950 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(`applications.filters.${status}`)}
          </button>
        ))}
      </div>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('applications.search')}</span>
        <input
          type="search"
          name="applicationSearch"
          maxLength={160}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t('applications.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>

      {applicationsQuery.isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500">
          {t('states.loading', { ns: 'common' })}
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-gray-700">{t('applications.empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="hidden grid-cols-[44px_minmax(0,1.5fr)_180px_150px_140px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-bold uppercase text-gray-500 lg:grid">
            <span>{t('labels.number', { ns: 'common' })}</span>
            <span>{t('applications.company')}</span>
            <span>{t('applications.submittedAt')}</span>
            <span>{t('applications.plan')}</span>
            <span>{t('labels.status', { ns: 'common' })}</span>
          </div>
          <div className="divide-y divide-gray-200">
            {pageApplications.map((application, index) => (
              <article
                key={application.id}
                role="button"
                tabIndex={0}
                onClick={() => openReview(application)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openReview(application);
                }}
                className="grid cursor-pointer gap-3 px-5 py-4 transition hover:bg-gray-50 lg:grid-cols-[44px_minmax(0,1.5fr)_180px_150px_140px] lg:items-center"
              >
                <span className="text-left text-sm text-gray-500">
                  {(page - 1) * 15 + index + 1}
                </span>
                <div className="min-w-0 self-center">
                  <p className="truncate font-bold text-gray-950" title={application.trade_name}>
                    {application.trade_name}
                  </p>
                </div>
                <div className="self-center whitespace-nowrap text-sm text-gray-600">
                  {dateTime.format(new Date(application.submitted_at))}
                </div>
                <div className="self-center truncate whitespace-nowrap text-sm font-bold">
                  {t(`pricing.${application.plan_code}.name`, { ns: 'marketing' })}
                </div>
                <StatusBadge status={application.status} />
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            totalItems={applications.length}
            onPageChange={setPage}
            previousLabel={t('pagination.previous', { ns: 'common' })}
            nextLabel={t('pagination.next', { ns: 'common' })}
            pageLabel={(current, total) =>
              t('pagination.page', { ns: 'common', page: current, totalPages: total })
            }
          />
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="application-review-title"
        >
          <div className="max-h-[94svh] w-full max-w-3xl overflow-y-auto rounded-t-lg bg-white shadow-xl sm:rounded-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <p className="font-mono text-xs font-bold text-brand-700">
                  {selected.reference_code}
                </p>
                <h2 id="application-review-title" className="mt-1 text-xl font-bold">
                  {t('applications.details')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                aria-label={t('actions.close', { ns: 'common' })}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {selected.status === 'pending' && draft && (
              <ApplicationEditForm
                application={draft}
                onChange={setDraft}
                onSave={() => updateMutation.mutate()}
                saving={updateMutation.isPending}
              />
            )}

            <div className="grid gap-px bg-gray-200 sm:grid-cols-2">
              <Detail label={t('applications.legalName')} value={selected.legal_name} />
              <Detail
                label={t('applications.businessType')}
                value={t(`registration.businessTypes.${selected.business_type}`, {
                  ns: 'marketing',
                })}
              />
              <Detail label={t('applications.workEmail')} value={selected.work_email} />
              <Detail label={t('applications.phone')} value={selected.phone} />
              <Detail
                className="sm:col-span-2"
                label={t('applications.address')}
                value={[
                  selected.postal_code,
                  selected.prefecture,
                  selected.city,
                  selected.address_line1,
                  selected.address_line2,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <Detail
                label={t('applications.usage')}
                value={`${t('applications.locations', { count: selected.location_count })} · ${t(
                  'applications.monthlyCustomers',
                  { count: selected.expected_monthly_customers }
                )}`}
              />
              <Detail
                label={t('applications.payment')}
                value={`${currency.format(selected.amount_yen)} · ${t(
                  selected.payment_status === 'refunded'
                    ? 'applications.refunded'
                    : 'applications.paid'
                )}`}
              />
            </div>

            <div className="p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold">{t('applications.note')}</span>
                <textarea
                  name="reviewNote"
                  maxLength={1000}
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t('applications.notePlaceholder')}
                  disabled={selected.status !== 'pending'}
                  className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
                />
              </label>

              {selected.status === 'pending' ? (
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => review('reject')}
                    disabled={reviewMutation.isPending}
                    className="rounded-md border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {reviewMutation.isPending
                      ? t('applications.rejecting')
                      : t('applications.reject')}
                  </button>
                  <button
                    type="button"
                    onClick={() => review('approve')}
                    disabled={reviewMutation.isPending}
                    className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {reviewMutation.isPending
                      ? t('applications.approving')
                      : t('applications.approve')}
                  </button>
                </div>
              ) : (
                <div className="mt-5">
                  <StatusBadge status={selected.status} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: Readonly<{ status: ApplicationStatus }>) {
  const { t } = useTranslation('admin');
  const Icon = status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock3;
  const classes =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-800';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold ${classes}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`applications.status.${status}`)}
    </span>
  );
}

function ApplicationEditForm({
  application,
  onChange,
  onSave,
  saving,
}: Readonly<{
  application: OrganizationApplication;
  onChange: (application: OrganizationApplication) => void;
  onSave: () => void;
  saving: boolean;
}>) {
  const { t } = useTranslation(['admin', 'marketing', 'common']);
  const set = <K extends keyof OrganizationApplication>(
    key: K,
    value: OrganizationApplication[K]
  ) => onChange({ ...application, [key]: value });
  const textFields: Array<{
    key: keyof OrganizationApplication;
    label: string;
    placeholder: string;
    type?: 'email' | 'url' | 'tel';
  }> = [
    {
      key: 'legal_name',
      label: t('applications.legalName'),
      placeholder: t('applications.placeholders.legalName'),
    },
    {
      key: 'trade_name',
      label: t('applications.tradeName'),
      placeholder: t('applications.placeholders.tradeName'),
    },
    {
      key: 'registration_number',
      label: t('applications.registrationNumber'),
      placeholder: t('applications.placeholders.registrationNumber'),
    },
    {
      key: 'website_url',
      label: t('applications.website'),
      placeholder: 'https://example.jp',
      type: 'url',
    },
    {
      key: 'contact_name',
      label: t('applications.contactName'),
      placeholder: t('applications.placeholders.contactName'),
    },
    {
      key: 'contact_title',
      label: t('applications.contactTitle'),
      placeholder: t('applications.placeholders.contactTitle'),
    },
    {
      key: 'work_email',
      label: t('applications.workEmail'),
      placeholder: 'manager@example.jp',
      type: 'email',
    },
    {
      key: 'phone',
      label: t('applications.phone'),
      placeholder: '03-1234-5678',
      type: 'tel',
    },
    {
      key: 'postal_code',
      label: t('applications.postalCode'),
      placeholder: '100-0001',
    },
    {
      key: 'prefecture',
      label: t('applications.prefecture'),
      placeholder: t('applications.placeholders.prefecture'),
    },
    {
      key: 'city',
      label: t('applications.city'),
      placeholder: t('applications.placeholders.city'),
    },
    {
      key: 'address_line1',
      label: t('applications.addressLine1'),
      placeholder: t('applications.placeholders.addressLine1'),
    },
    {
      key: 'address_line2',
      label: t('applications.addressLine2'),
      placeholder: t('applications.placeholders.addressLine2'),
    },
  ];

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-5">
      <div className="mb-4">
        <h3 className="font-bold text-gray-950">{t('applications.editSubmittedDetails')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('applications.editSubmittedHint')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {textFields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block text-xs font-bold text-gray-600">{field.label}</span>
            <input
              name={field.key}
              maxLength={applicationFieldMaxLength(field.key)}
              type={field.type ?? 'text'}
              value={String(application[field.key] ?? '')}
              placeholder={field.placeholder}
              onChange={(event) =>
                set(
                  field.key,
                  (event.target.value || null) as OrganizationApplication[typeof field.key]
                )
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        ))}
        <SelectField
          label={t('applications.businessType')}
          value={application.business_type}
          onChange={(value) => set('business_type', value)}
          options={['restaurant', 'salon', 'clinic', 'retail', 'public_service', 'other'].map(
            (value) => ({
              value,
              label: t(`registration.businessTypes.${value}`, { ns: 'marketing' }),
            })
          )}
        />
        <NumberField
          label={t('applications.locationCount')}
          value={application.location_count}
          min={NUMERIC_LIMITS.organizationLocationCount.min}
          max={NUMERIC_LIMITS.organizationLocationCount.max}
          placeholder="1"
          onChange={(value) => set('location_count', value)}
        />
        <NumberField
          label={t('applications.expectedCustomers')}
          value={application.expected_monthly_customers}
          min={NUMERIC_LIMITS.expectedMonthlyCustomers.min}
          max={NUMERIC_LIMITS.expectedMonthlyCustomers.max}
          placeholder="1000"
          onChange={(value) => set('expected_monthly_customers', value)}
        />
        <SelectField
          label={t('applications.plan')}
          value={application.plan_code}
          onChange={(value) => set('plan_code', value as OrganizationApplication['plan_code'])}
          options={['starter', 'standard', 'scale'].map((value) => ({
            value,
            label: t(`pricing.${value}.name`, { ns: 'marketing' }),
          }))}
        />
        <SelectField
          label={t('applications.billingCycle')}
          value={application.billing_cycle}
          onChange={(value) =>
            set('billing_cycle', value as OrganizationApplication['billing_cycle'])
          }
          options={['monthly', 'annual'].map((value) => ({
            value,
            label: t(`applications.billingCycles.${value}`),
          }))}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? t('applications.saving') : t('applications.saveChanges')}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  placeholder: string;
  onChange: (value: number) => void;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-gray-600">{label}</span>
      <BoundedNumberInput
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onValueChange={(nextValue) => {
          if (nextValue !== '') onChange(Number(nextValue));
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function applicationFieldMaxLength(key: keyof OrganizationApplication): number | undefined {
  const limits: Partial<Record<keyof OrganizationApplication, number>> = {
    legal_name: 200,
    trade_name: 160,
    registration_number: 32,
    website_url: 500,
    contact_name: 120,
    contact_title: 120,
    work_email: 254,
    phone: 20,
    postal_code: 8,
    prefecture: 20,
    city: 100,
    address_line1: 200,
    address_line2: 200,
  };
  return limits[key];
}

function Detail({
  label,
  value,
  className = '',
}: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className={`bg-white p-5 ${className}`}>
      <dt className="text-xs font-bold uppercase text-gray-500">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
