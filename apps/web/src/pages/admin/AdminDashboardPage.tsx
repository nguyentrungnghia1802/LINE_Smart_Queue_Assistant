import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { API_BASE_PATH } from '@line-queue/shared';

import { formatCurrency } from '../../i18n/format';
import { get } from '../../services/apiClient';

interface DashboardData {
  organizationCount: number;
  pendingApplicationCount: number;
  totalRevenue: number;
  planCounts: { starter: number; standard: number; scale: number };
  monthlyRevenue: Array<{ month: string; revenue: number }>;
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation(['admin', 'marketing']);
  const dashboard = useQuery<DashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => get(`${API_BASE_PATH}/admin/dashboard`),
  });

  if (dashboard.isLoading || !dashboard.data) {
    return <p className="text-sm text-gray-500">{t('dashboard.loading')}</p>;
  }
  const data = dashboard.data;
  const maxRevenue = Math.max(...data.monthlyRevenue.map((point) => point.revenue), 1);
  const locale = i18n.resolvedLanguage ?? 'ja';

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase text-brand-700">{t('dashboard.section')}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.description')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t('dashboard.organizationCount')} value={String(data.organizationCount)} />
        <Metric
          label={t('applications.pendingCount')}
          value={String(data.pendingApplicationCount)}
          tone="amber"
        />
        <Metric
          label={t('dashboard.totalPlatformRevenue')}
          value={formatCurrency(data.totalRevenue, locale)}
          tone="green"
        />
        <Metric
          label={t('dashboard.registeredPlans')}
          value={String(Object.values(data.planCounts).reduce((sum, count) => sum + count, 0))}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {(['starter', 'standard', 'scale'] as const).map((plan) => (
          <div key={plan} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-bold text-gray-700">
              {t(`pricing.${plan}.name`, { ns: 'marketing' })}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-950">{data.planCounts[plan]}</p>
            <p className="mt-1 text-xs text-gray-500">{t('dashboard.organizationsByPlan')}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-bold text-gray-950">{t('dashboard.monthlyRevenue')}</h2>
        <div className="mt-6 grid h-56 grid-cols-12 items-end gap-1.5 sm:gap-3">
          {data.monthlyRevenue.map((point) => (
            <div
              key={point.month}
              className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
              title={`${point.month}: ${formatCurrency(point.revenue, locale)}`}
            >
              <div className="flex h-48 w-full items-end">
                <div
                  className="w-full rounded-t bg-brand-600"
                  style={{ height: `${Math.max(3, (point.revenue / maxRevenue) * 100)}%` }}
                />
              </div>
              <span className="hidden text-[10px] text-gray-500 sm:block">
                {point.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: Readonly<{ label: string; value: string; tone?: 'default' | 'amber' | 'green' }>) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-gray-200 bg-white';
  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
    </div>
  );
}
