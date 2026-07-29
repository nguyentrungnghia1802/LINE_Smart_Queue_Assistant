import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { formatCurrency as formatLocalizedCurrency } from '../../i18n/format';
import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface StatsData {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  cancellationRate: number;
  activeQueueEntries: number;
  averageEtaSeconds: number;
  totalProducts: number;
  currentQueueDepth: number;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
  bestStaff: {
    user_id: string;
    display_name: string;
    employee_code: string | null;
    completed_orders: number;
    revenue: number;
  } | null;
}

interface WaitForecast {
  id: string;
  queue_id: string;
  queue_name: string;
  forecasted_wait_seconds: number;
  queue_depth: number;
  active_staff_count: number;
  confidence: string;
  model_version: string;
  explanation: string;
  generated_at: string;
}

interface StaffingRecommendation {
  id: string;
  day_of_week: number;
  hour_of_day: number;
  recommended_staff_count: number;
  confidence: string;
  model_version: string;
  explanation: string;
  generated_at: string;
}

interface OwnerBranchAnalytics {
  branch_id: string;
  branch_name: string;
  total_revenue: string;
  order_count: number;
  cancelled_count: number;
  cancellation_rate: string;
  queue_count: number;
}

interface OwnerAnalytics {
  totalRevenue: number;
  totalBranches: number;
  bestBranch: OwnerBranchAnalytics | null;
  lowestBranch: OwnerBranchAnalytics | null;
  branches: OwnerBranchAnalytics[];
  revenueSeries: Array<{ revenue_date: string; revenue: string }>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function RevenueBarChart({
  points,
  formatMoney,
  labelEvery = 1,
}: Readonly<{
  points: Array<{ label: string; value: number }>;
  formatMoney: (value: number) => string;
  labelEvery?: number;
}>) {
  const normalized = points.map((point) => ({
    ...point,
    value: Number.isFinite(point.value) ? Math.max(0, point.value) : 0,
  }));
  const maxRevenue = Math.max(...normalized.map((point) => point.value), 1);

  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <div className="flex h-48 min-w-[36rem] items-stretch gap-1.5 sm:min-w-0 sm:gap-2" role="img">
        {normalized.map((point, index) => {
          const height = point.value > 0 ? Math.max(6, (point.value / maxRevenue) * 100) : 2;
          const showLabel = index % labelEvery === 0 || index === normalized.length - 1;
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-end">
                <div
                  className={`w-full rounded-t transition-[height] duration-500 ${
                    point.value > 0 ? 'bg-brand-500' : 'bg-gray-200'
                  }`}
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${formatMoney(point.value)}`}
                  aria-label={`${point.label}: ${formatMoney(point.value)}`}
                />
              </div>
              <span className="mt-2 h-4 truncate text-center text-[10px] text-gray-400">
                {showLabel ? point.label : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ManagerDashboardPage() {
  const { t, i18n } = useTranslation(['manager', 'common', 'staff']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const branchId = user?.branchIds?.[0];
  const isOwner = user?.isOrganizationOwner === true;

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['orders-stats', orgId, branchId],
    queryFn: () => get<StatsData>('/api/v1/orders/stats'),
    enabled: !!orgId && !isOwner,
    refetchInterval: 30_000,
  });
  const forecasts = useQuery<WaitForecast[]>({
    queryKey: ['wait-forecasts', orgId, branchId],
    queryFn: () => get<WaitForecast[]>('/api/v1/forecasts/wait'),
    enabled: !!orgId && !isOwner,
  });
  const staffing = useQuery<StaffingRecommendation[]>({
    queryKey: ['staffing-recommendations', orgId, branchId],
    queryFn: () => get<StaffingRecommendation[]>('/api/v1/forecasts/staffing'),
    enabled: !!orgId && !isOwner,
  });
  const ownerAnalytics = useQuery<OwnerAnalytics>({
    queryKey: ['owner-branch-analytics', orgId],
    queryFn: () => get<OwnerAnalytics>('/api/v1/branches/analytics'),
    enabled: !!orgId && isOwner,
    refetchInterval: 60_000,
  });

  if (isOwner) {
    if (ownerAnalytics.isLoading || !ownerAnalytics.data) {
      return <div className="text-sm text-gray-400">{t('states.loading', { ns: 'common' })}</div>;
    }
    return (
      <OwnerManagerDashboard
        data={ownerAnalytics.data}
        locale={i18n.resolvedLanguage ?? 'ja'}
        t={t}
      />
    );
  }

  if (isLoading || !data) {
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;
  }

  const formatMoney = (value: number) =>
    formatLocalizedCurrency(value, i18n.resolvedLanguage ?? 'ja');
  const formatMinutes = (seconds: number) =>
    t('units.minutes', { ns: 'common', count: Math.ceil(seconds / 60) });

  const cancellationRate = Math.round(data.cancellationRate * 100);
  const waitForecast = forecasts.data?.[0];
  const recommendedSlot = staffing.data?.reduce<StaffingRecommendation | undefined>(
    (best, item) =>
      !best || item.recommended_staff_count > best.recommended_staff_count ? item : best,
    undefined
  );
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          {t('dashboard.section', { ns: 'manager' })}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">
          {t('dashboard.title', { ns: 'manager' })}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dashboard.totalRevenue')} value={formatMoney(data.totalRevenue)} />
        <StatCard label={t('dashboard.totalOrders')} value={String(data.totalOrders)} />
        <StatCard label={t('dashboard.completedOrders')} value={String(data.completedOrders)} />
        <StatCard label={t('dashboard.cancelledOrders')} value={String(data.cancelledOrders)} />
        <StatCard label={t('dashboard.cancellationRate')} value={`${cancellationRate}%`} />
        <StatCard
          label={t('dashboard.processingOrders')}
          value={String(data.pendingOrders)}
          sub={t('dashboard.productCount', { count: data.totalProducts })}
        />
        <StatCard label={t('dashboard.waitingCustomers')} value={String(data.activeQueueEntries)} />
        <StatCard label={t('dashboard.averageEta')} value={formatMinutes(data.averageEtaSeconds)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {t('dashboard.performanceForecast')}
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">{t('dashboard.waitEstimate')}</h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">
            {waitForecast
              ? formatMinutes(waitForecast.forecasted_wait_seconds)
              : t('dashboard.pendingData')}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {waitForecast
              ? t('dashboard.waitExplanation', {
                  queueDepth: waitForecast.queue_depth,
                  staffCount: waitForecast.active_staff_count,
                })
              : t('dashboard.pendingAggregation')}
          </p>
          {waitForecast && (
            <p className="mt-2 text-xs text-gray-400">
              {t('dashboard.confidence', {
                value: Math.round(Number(waitForecast.confidence) * 100),
              })}{' '}
              · {waitForecast.model_version}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {t('dashboard.shiftSuggestion')}
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">
            {t('dashboard.recommendedStaff')}
          </h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">
            {recommendedSlot
              ? t('units.people', { ns: 'common', count: recommendedSlot.recommended_staff_count })
              : t('dashboard.pendingData')}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {recommendedSlot
              ? t('dashboard.staffingExplanation', {
                  day: recommendedSlot.day_of_week,
                  hour: recommendedSlot.hour_of_day,
                })
              : t('dashboard.pendingAggregation')}
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {t('dashboard.bestStaff')}
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">
            {data.bestStaff?.display_name ?? t('dashboard.pendingData')}
          </h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">
            {data.bestStaff ? formatMoney(data.bestStaff.revenue) : '-'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {data.bestStaff
              ? t('dashboard.bestStaffOrders', { count: data.bestStaff.completed_orders })
              : t('dashboard.pendingAggregation')}
          </p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 font-bold text-gray-950">{t('dashboard.monthlyRevenue')}</h2>
        {data.monthlyRevenue.length === 0 ? (
          <p className="text-sm text-gray-400">{t('states.empty', { ns: 'common' })}</p>
        ) : (
          <RevenueBarChart
            points={data.monthlyRevenue.map((point) => ({
              label: point.month.slice(5),
              value: Number(point.revenue),
            }))}
            formatMoney={formatMoney}
          />
        )}
      </div>

      {/* Top products */}
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-3 font-bold text-gray-950">{t('dashboard.topProducts')}</h2>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">{t('states.empty', { ns: 'common' })}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="w-12 pb-2 font-medium">{t('labels.number', { ns: 'common' })}</th>
                <th className="pb-2 font-medium">{t('labels.product', { ns: 'common' })}</th>
                <th className="pb-2 font-medium text-right">{t('dashboard.salesCount')}</th>
                <th className="pb-2 font-medium text-right">{t('dashboard.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={p.product_name} className="border-b border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 text-gray-800">{p.product_name}</td>
                  <td className="py-2 text-right text-gray-600">{p.total_sold}</td>
                  <td className="py-2 text-right text-gray-800">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OwnerManagerDashboard({
  data,
  locale,
  t,
}: {
  data: OwnerAnalytics;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const formatMoney = (value: number | string) => formatLocalizedCurrency(Number(value), locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {t('ownerDashboard.section')}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('ownerDashboard.title')}</h1>
        </div>
        <Link
          to="/manager/branches"
          className="rounded-lg bg-gray-950 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          {t('ownerDashboard.manageBranches')}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('ownerDashboard.totalRevenue')} value={formatMoney(data.totalRevenue)} />
        <StatCard label={t('ownerDashboard.totalBranches')} value={String(data.totalBranches)} />
        <StatCard
          label={t('ownerDashboard.bestBranch')}
          value={data.bestBranch?.branch_name ?? '-'}
          sub={data.bestBranch ? formatMoney(data.bestBranch.total_revenue) : undefined}
        />
        <StatCard
          label={t('ownerDashboard.lowestBranch')}
          value={data.lowestBranch?.branch_name ?? '-'}
          sub={data.lowestBranch ? formatMoney(data.lowestBranch.total_revenue) : undefined}
        />
      </div>

      <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-bold text-gray-950">{t('ownerDashboard.revenueChart')}</h2>
        <RevenueBarChart
          points={data.revenueSeries.map((point) => ({
            label: point.revenue_date.slice(5),
            value: Number(point.revenue),
          }))}
          formatMoney={(value) => formatMoney(value)}
          labelEvery={5}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-bold text-gray-950">{t('ownerDashboard.branchPerformance')}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.branches.map((branch, index) => (
            <Link
              key={branch.branch_id}
              to={`/manager/branches/${branch.branch_id}`}
              className="grid gap-3 px-5 py-4 transition hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center sm:gap-8"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-gray-950">
                  <span className="mr-2 text-gray-400">{index + 1}.</span>
                  {branch.branch_name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('ownerDashboard.queueCount', { count: branch.queue_count })}
                </p>
              </div>
              <MetricText
                label={t('ownerDashboard.revenue')}
                value={formatMoney(branch.total_revenue)}
              />
              <MetricText label={t('ownerDashboard.orders')} value={String(branch.order_count)} />
              <MetricText
                label={t('ownerDashboard.cancellationRate')}
                value={`${branch.cancellation_rate}%`}
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
