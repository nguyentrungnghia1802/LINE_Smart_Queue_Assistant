import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { formatCurrency } from '../../i18n/format';
import { get } from '../../services/apiClient';

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
          〒{branch.postal_code} {branch.prefecture}
          {branch.city}
          {branch.address_line1}
          {branch.address_line2 ?? ''}
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
          <div className="mt-4 space-y-2">
            {branch.managers.map((manager) => (
              <div key={manager.id} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-sm font-semibold text-gray-900">{manager.displayName}</p>
                <p className="mt-0.5 text-xs text-gray-500">{manager.email}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-950">{t('branches.queues')}</h2>
          <div className="mt-4 space-y-2">
            {branch.queues.map((queue) => (
              <div
                key={queue.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
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
