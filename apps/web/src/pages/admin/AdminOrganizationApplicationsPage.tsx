import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock3, X, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_BASE_PATH } from '@line-queue/shared';

import { ApiClientError, get, post } from '../../services/apiClient';

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
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
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

  function openReview(application: OrganizationApplication) {
    setSelected(application);
    setNote(application.review_note ?? '');
    setFeedback('');
  }

  function review(action: 'approve' | 'reject') {
    const confirmation =
      action === 'approve' ? t('applications.approveConfirm') : t('applications.rejectConfirm');
    if (!window.confirm(confirmation)) return;
    reviewMutation.mutate(action);
  }

  const applications = applicationsQuery.data ?? [];

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
            onClick={() => setFilter(status)}
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
          <div className="hidden grid-cols-[130px_1.4fr_1fr_150px_120px] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-bold uppercase text-gray-500 lg:grid">
            <span>{t('applications.reference')}</span>
            <span>{t('applications.company')}</span>
            <span>{t('applications.contact')}</span>
            <span>{t('applications.plan')}</span>
            <span />
          </div>
          <div className="divide-y divide-gray-200">
            {applications.map((application) => (
              <article
                key={application.id}
                className="grid gap-4 px-5 py-5 lg:grid-cols-[130px_1.4fr_1fr_150px_120px] lg:items-center"
              >
                <div>
                  <p className="font-mono text-sm font-bold">{application.reference_code}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {dateTime.format(new Date(application.submitted_at))}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-gray-950">{application.trade_name}</p>
                  <p className="mt-1 text-sm text-gray-500">{application.legal_name}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{application.contact_name}</p>
                  <p className="mt-1 break-all text-xs text-gray-500">{application.work_email}</p>
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {t(`pricing.${application.plan_code}.name`, { ns: 'marketing' })}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {currency.format(application.amount_yen)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 lg:block">
                  <StatusBadge status={application.status} />
                  <button
                    type="button"
                    onClick={() => openReview(application)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-bold hover:bg-gray-50 lg:mt-2 lg:w-full"
                  >
                    {t('applications.review')}
                  </button>
                </div>
              </article>
            ))}
          </div>
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
