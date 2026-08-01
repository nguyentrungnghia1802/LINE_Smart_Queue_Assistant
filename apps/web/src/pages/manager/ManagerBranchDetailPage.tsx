import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { formatCurrency } from '../../i18n/format';
import { del, get } from '../../services/apiClient';
import { formatAddress } from '../../utils/address';
import { INPUT_LIMITS } from '../../utils/formValidation';

interface Branch {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  manager_count: number;
  staff_count: number;
  managers: Array<{
    id: string;
    displayName: string;
    email: string;
    accountStatus: string;
  }>;
  queues: Array<{ id: string; name: string; status: string }>;
}

interface BranchAnalytics {
  branch_id: string;
  total_revenue: string;
  order_count: number;
  cancelled_count: number;
  cancellation_rate: string;
  queue_count: number;
}

interface AnalyticsResponse {
  branches: BranchAnalytics[];
}

export function ManagerBranchDetailPage() {
  const { branchId = '' } = useParams();
  const { t, i18n } = useTranslation(['manager', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [managerSearch, setManagerSearch] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const branches = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => get('/api/v1/branches'),
  });
  const analytics = useQuery<AnalyticsResponse>({
    queryKey: ['owner-branch-analytics'],
    queryFn: () => get('/api/v1/branches/analytics'),
  });
  const branch = branches.data?.find((item) => item.id === branchId);
  const metrics = analytics.data?.branches.find((item) => item.branch_id === branchId);
  const deleteMutation = useMutation({
    mutationFn: () => del(`/api/v1/branches/${branchId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branches'] }),
        queryClient.invalidateQueries({ queryKey: ['owner-branch-analytics'] }),
      ]);
      navigate('/manager/branches', { replace: true });
    },
  });
  const visibleManagers = useMemo(() => {
    const query = managerSearch.trim().toLocaleLowerCase();
    return (
      branch?.managers.filter(
        (manager) =>
          !query ||
          manager.displayName.toLocaleLowerCase().includes(query) ||
          manager.email.toLocaleLowerCase().includes(query)
      ) ?? []
    );
  }, [branch?.managers, managerSearch]);
  const visibleQueues = useMemo(() => {
    const query = queueSearch.trim().toLocaleLowerCase();
    return (
      branch?.queues.filter((queue) => !query || queue.name.toLocaleLowerCase().includes(query)) ??
      []
    );
  }, [branch?.queues, queueSearch]);

  if (branches.isLoading || analytics.isLoading) {
    return <p className="text-sm text-gray-500">{t('states.loading', { ns: 'common' })}</p>;
  }
  if (!branch) {
    return <p className="text-sm text-red-700">{t('branches.notFound')}</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/manager/branches" className="text-sm font-semibold text-brand-700">
          {t('branches.backToList')}
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-950">{branch.name}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {formatAddress(
            {
              postalCode: branch.postal_code,
              prefecture: branch.prefecture,
              city: branch.city,
              addressLine1: branch.address_line1,
              addressLine2: branch.address_line2,
            },
            i18n.resolvedLanguage
          )}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t('ownerDashboard.revenue')}
          value={formatCurrency(Number(metrics?.total_revenue ?? 0), i18n.resolvedLanguage ?? 'ja')}
        />
        <Metric label={t('ownerDashboard.orders')} value={String(metrics?.order_count ?? 0)} />
        <Metric
          label={t('ownerDashboard.cancellationRate')}
          value={`${metrics?.cancellation_rate ?? 0}%`}
        />
        <Metric
          label={t('ownerDashboard.queueCount', { count: branch.queues.length })}
          value={String(branch.queues.length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('branches.contact')}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label={t('branches.fields.phone')} value={branch.phone} />
            <Row label={t('branches.fields.email')} value={branch.email ?? '-'} />
            <Row label={t('branches.managers')} value={String(branch.manager_count)} />
            <Row label={t('branches.staff')} value={String(branch.staff_count)} />
          </dl>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('branches.managers')}</h2>
          <SearchField
            value={managerSearch}
            onChange={setManagerSearch}
            label={t('branches.managerSearch')}
            placeholder={t('branches.managerSearchPlaceholder')}
          />
          <div className="mt-4 space-y-2">
            {visibleManagers.map((manager, index) => (
              <div
                key={manager.id}
                className="grid grid-cols-[32px_1fr] gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-left text-sm text-gray-500">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {manager.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{manager.email}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('branches.queues')}</h2>
          <SearchField
            value={queueSearch}
            onChange={setQueueSearch}
            label={t('branches.queueSearch')}
            placeholder={t('branches.queueSearchPlaceholder')}
          />
          <div className="mt-4 space-y-2">
            {visibleQueues.map((queue, index) => (
              <div
                key={queue.id}
                className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-left text-gray-500">{index + 1}</span>
                <span className="font-semibold text-gray-900">{queue.name}</span>
                <span className="text-xs text-gray-500">
                  {t(`states.${queue.status}`, {
                    ns: 'common',
                    defaultValue: queue.status,
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold text-gray-950">{t('branches.deleteTitle')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              {t('branches.deleteDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t('branches.deleteAction')}
          </button>
        </div>
      </section>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-branch-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="delete-branch-title" className="text-xl font-bold text-gray-950">
              {t('branches.deleteConfirmTitle')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {t('branches.deleteConfirmDescription', { name: branch.name })}
            </p>
            {deleteMutation.error && (
              <p className="mt-4 text-sm font-medium text-red-700" role="alert">
                {deleteMutation.error.message}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                {t('actions.cancel', { ns: 'common' })}
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleteMutation.isPending
                  ? t('branches.deleting')
                  : t('branches.deleteConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3">
      <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        name="branchDetailSearch"
        maxLength={INPUT_LIMITS.search}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 py-2 text-sm outline-none"
      />
    </label>
  );
}
