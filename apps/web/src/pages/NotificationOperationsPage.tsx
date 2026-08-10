import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellRing, RefreshCw, SearchX, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Pagination } from '../components/ui/Pagination';
import {
  type NotificationOperationDetail,
  type NotificationOperationFilters,
  notificationOperationsApi,
  type NotificationOperationSummary,
} from '../services/notificationOperations.api';
import { useAuthStore } from '../store/authStore';

const PAGE_SIZE = 20;
const STATUSES = ['pending', 'processing', 'sent', 'failed', 'cancelled'] as const;
const EVENTS = [
  'booking_created',
  'eta_warning',
  'called',
  'serving',
  'completed',
  'cancelled',
  'no_show',
  'deferred',
  'location_warning',
] as const;

export function NotificationOperationsPage() {
  const { t, i18n } = useTranslation('common');
  const user = useAuthStore((state) => state.user);
  const [filters, setFilters] = useState<NotificationOperationFilters>({
    page: 1,
    limit: PAGE_SIZE,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const list = useQuery({
    queryKey: ['notification-operations', filters],
    queryFn: () => notificationOperationsApi.list(filters),
  });

  const setFilter = (key: keyof NotificationOperationFilters, value: string) =>
    setFilters((current) => ({ ...current, page: 1, [key]: value || undefined }));

  // Staff cannot cancel — only branch managers can.
  const canCancel = user?.role !== 'staff';

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-brand-700">
            {t('notificationOperations.section')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">
            {t('notificationOperations.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {t('notificationOperations.description')}
          </p>
        </div>
        <button
          type="button"
          disabled={list.isFetching}
          onClick={() => {
            setFeedback('');
            void list.refetch();
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 transition-transform ${list.isFetching ? 'animate-spin text-brand-600' : ''}`}
            aria-hidden="true"
          />
          <span>{t('notificationOperations.refresh')}</span>
        </button>
      </header>

      <section className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label={t('notificationOperations.filters.status')}
          value={filters.status ?? ''}
          onChange={(value) => setFilter('status', value)}
          options={STATUSES.map((value) => ({
            value,
            label: t(`notificationOperations.status.${value}`),
          }))}
          allLabel={t('notificationOperations.filters.all')}
        />
        <FilterSelect
          label={t('notificationOperations.filters.event')}
          value={filters.eventType ?? ''}
          onChange={(value) => setFilter('eventType', value)}
          options={EVENTS.map((value) => ({
            value,
            label: t(`notificationOperations.events.${value}`),
          }))}
          allLabel={t('notificationOperations.filters.all')}
        />
        <FilterInput
          type="datetime-local"
          label={t('notificationOperations.filters.from')}
          value={filters.createdFrom?.slice(0, 16) ?? ''}
          onChange={(value) => setFilter('createdFrom', value ? new Date(value).toISOString() : '')}
        />
        <FilterInput
          type="datetime-local"
          label={t('notificationOperations.filters.to')}
          value={filters.createdTo?.slice(0, 16) ?? ''}
          onChange={(value) => setFilter('createdTo', value ? new Date(value).toISOString() : '')}
        />
      </section>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {list.isLoading ? (
          <StatePanel label={t('notificationOperations.loading')} />
        ) : list.isError ? (
          <StatePanel label={t('notificationOperations.loadFailed')} error />
        ) : !list.data?.items.length ? (
          <StatePanel label={t('notificationOperations.empty')} empty />
        ) : (
          <>
            <div className="hidden grid-cols-[130px_minmax(130px,1fr)_minmax(130px,1fr)_130px_100px_150px] gap-3 border-b border-gray-100 px-4 py-3 text-xs font-bold text-gray-500 lg:grid">
              <span>{t('notificationOperations.columns.ticket')}</span>
              <span>{t('notificationOperations.columns.scope')}</span>
              <span>{t('notificationOperations.columns.event')}</span>
              <span>{t('notificationOperations.columns.status')}</span>
              <span>{t('notificationOperations.columns.attempts')}</span>
              <span>{t('notificationOperations.columns.created')}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {list.data.items.map((item) => (
                <OperationRow
                  key={item.id}
                  item={item}
                  locale={i18n.resolvedLanguage ?? 'ja'}
                  onOpen={() => setSelectedId(item.id)}
                />
              ))}
            </div>
            <Pagination
              page={filters.page}
              pageSize={PAGE_SIZE}
              totalItems={list.data.total}
              onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              previousLabel={t('pagination.previous')}
              nextLabel={t('pagination.next')}
              pageLabel={(page, total) => t('pagination.page', { page, totalPages: total })}
            />
          </>
        )}
      </section>

      {selectedId && (
        <OperationDetailDialog
          id={selectedId}
          canCancel={canCancel}
          onClose={() => setSelectedId(null)}
          onSuccess={(message) => {
            setFeedback(message);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function OperationRow({
  item,
  locale,
  onOpen,
}: Readonly<{ item: NotificationOperationSummary; locale: string; onOpen: () => void }>) {
  const { t } = useTranslation('common');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full gap-3 px-4 py-4 text-left hover:bg-gray-50 lg:grid-cols-[130px_minmax(130px,1fr)_minmax(130px,1fr)_130px_100px_150px] lg:items-center"
    >
      <div>
        <p className="font-mono text-sm font-bold text-gray-950">{item.ticketCode ?? '—'}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">{item.lineRecipient ?? '—'}</p>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-gray-900">
          {item.branchName ?? item.organizationName ?? '—'}
        </p>
        <p className="truncate text-xs text-gray-500">{item.queueName ?? '—'}</p>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium text-gray-900">
          {t(`notificationOperations.events.${item.eventType}`, { defaultValue: item.eventType })}
        </p>
        {item.failureCategory && (
          <p className="truncate text-xs text-rose-700">
            {t(`notificationOperations.failures.${item.failureCategory}`)}
          </p>
        )}
      </div>
      <StatusBadge status={item.status} />
      <span className="text-sm text-gray-600">
        {item.attemptCount}/{item.maxAttempts}
      </span>
      <time className="text-xs text-gray-500">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(item.createdAt)
        )}
      </time>
    </button>
  );
}

function OperationDetailDialog({
  id,
  canCancel,
  onClose,
  onSuccess,
}: Readonly<{
  id: string;
  canCancel: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}>) {
  const { t, i18n } = useTranslation('common');
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const detail = useQuery({
    queryKey: ['notification-operation', id],
    queryFn: () => notificationOperationsApi.detail(id),
  });
  const action = useMutation({
    mutationFn: ({ kind, value }: { kind: 'retry' | 'cancel'; value: string }) =>
      kind === 'retry'
        ? notificationOperationsApi.retry(id, value)
        : notificationOperationsApi.cancel(id, value),
    onSuccess: (_data, variables) => {
      void client.invalidateQueries({ queryKey: ['notification-operations'] });
      onSuccess(t(`notificationOperations.actions.${variables.kind}Success`));
    },
  });
  const item = detail.data;
  const run = (kind: 'retry' | 'cancel') => {
    if (reason.trim().length < 3) return;
    action.mutate({ kind, value: reason.trim() });
  };

  // Staff: can retry but cannot cancel.
  const showCancel = canCancel && item?.canCancel;
  const showRetry = item?.canRetry;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('notificationOperations.detail.title')}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-2xl sm:max-w-2xl sm:rounded-lg"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h2 className="font-bold text-gray-950">{t('notificationOperations.detail.title')}</h2>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={t('actions.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {detail.isLoading ? (
          <StatePanel label={t('notificationOperations.loading')} />
        ) : detail.isError || !item ? (
          <StatePanel label={t('notificationOperations.detail.loadFailed')} error />
        ) : (
          <div className="space-y-5 p-5">
            <DetailGrid item={item} locale={i18n.resolvedLanguage ?? 'ja'} />
            {item.sanitizedLastError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold uppercase text-rose-700">
                  {t('notificationOperations.detail.lastError')}
                </p>
                <p className="mt-2 break-words text-sm text-rose-900">{item.sanitizedLastError}</p>
              </div>
            )}
            {(showRetry || showCancel) && (
              <div className="space-y-3 border-t border-gray-100 pt-5">
                <label className="block text-sm font-bold text-gray-800" htmlFor="operation-reason">
                  {t('notificationOperations.actions.reason')}
                </label>
                <textarea
                  id="operation-reason"
                  name="operationReason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t('notificationOperations.actions.reasonPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {action.isError && (
                  <p className="text-sm text-rose-700">
                    {t('notificationOperations.actions.failed')}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {showCancel && (
                    <button
                      type="button"
                      disabled={reason.trim().length < 3 || action.isPending}
                      onClick={() => run('cancel')}
                      className="min-h-10 rounded-lg border border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {t('notificationOperations.actions.cancel')}
                    </button>
                  )}
                  {showRetry && (
                    <button
                      type="button"
                      disabled={reason.trim().length < 3 || action.isPending}
                      onClick={() => run('retry')}
                      className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-40"
                    >
                      {t('notificationOperations.actions.retry')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailGrid({
  item,
  locale,
}: Readonly<{ item: NotificationOperationDetail; locale: string }>) {
  const { t } = useTranslation('common');
  const fields = [
    ['ticket', item.ticketCode ?? '—'],
    [
      'event',
      t(`notificationOperations.events.${item.eventType}`, { defaultValue: item.eventType }),
    ],
    ['status', t(`notificationOperations.status.${item.status}`)],
    [
      'scope',
      [item.organizationName, item.branchName, item.queueName].filter(Boolean).join(' / ') || '—',
    ],
    ['locale', item.locale],
    ['attempts', `${item.attemptCount}/${item.maxAttempts}`],
    ['eventKey', item.eventKey],
    ['dispatch', item.dispatchStatus],
    [
      'created',
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(item.createdAt)
      ),
    ],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map(([key, value]) => (
        <div key={key} className="min-w-0 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <dt className="text-xs font-bold text-gray-500">
            {t(`notificationOperations.detail.${key}`)}
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }: Readonly<{ status: NotificationOperationSummary['status'] }>) {
  const { t } = useTranslation('common');
  const colors = {
    pending: 'bg-amber-50 text-amber-800',
    processing: 'bg-blue-50 text-blue-800',
    sent: 'bg-emerald-50 text-emerald-800',
    failed: 'bg-rose-50 text-rose-800',
    cancelled: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${colors[status]}`}>
      {t(`notificationOperations.status.${status}`)}
    </span>
  );
}

function StatePanel({
  label,
  error,
  empty,
}: Readonly<{ label: string; error?: boolean; empty?: boolean }>) {
  const Icon = error ? AlertTriangle : empty ? SearchX : BellRing;
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-gray-500">
      <Icon className="h-8 w-8" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}>) {
  return (
    <label className="text-xs font-bold text-gray-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}>) {
  return (
    <label className="text-xs font-bold text-gray-600">
      {label}
      <input
        type={type}
        value={value}
        maxLength={type === 'text' ? 36 : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal text-gray-800"
      />
    </label>
  );
}
