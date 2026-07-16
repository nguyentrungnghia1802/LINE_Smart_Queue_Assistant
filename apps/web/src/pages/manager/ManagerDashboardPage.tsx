import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string | null;
    status: string;
    subtotal: number;
    payment_status: string;
    created_at: string;
    item_count: number;
  }>;
  recentQueueActivities: Array<{
    entry_id: string;
    queue_id: string;
    queue_name: string;
    ticket_code: string;
    status: string;
    updated_at: string;
    order_number: string | null;
    customer_name: string | null;
  }>;
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function ManagerDashboardPage() {
  const { t, i18n } = useTranslation(['manager', 'common', 'staff']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;

  const { data, isLoading } = useQuery<StatsData>({
    queryKey: ['orders-stats', orgId],
    queryFn: () => get<StatsData>('/api/v1/orders/stats'),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
  const forecasts = useQuery<WaitForecast[]>({
    queryKey: ['wait-forecasts', orgId],
    queryFn: () => get<WaitForecast[]>('/api/v1/forecasts/wait'),
    enabled: !!orgId,
  });
  const staffing = useQuery<StaffingRecommendation[]>({
    queryKey: ['staffing-recommendations', orgId],
    queryFn: () => get<StaffingRecommendation[]>('/api/v1/forecasts/staffing'),
    enabled: !!orgId,
  });

  if (isLoading || !data) {
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;
  }

  const formatMoney = (value: number) =>
    formatLocalizedCurrency(value, i18n.resolvedLanguage ?? 'ja');
  const formatMinutes = (seconds: number) =>
    t('units.minutes', { ns: 'common', count: Math.ceil(seconds / 60) });

  const maxRevenue = Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
  const cancellationRate = Math.round(data.cancellationRate * 100);
  const waitForecast = forecasts.data?.[0];
  const recommendedSlot = staffing.data?.reduce<StaffingRecommendation | undefined>(
    (best, item) =>
      !best || item.recommended_staff_count > best.recommended_staff_count ? item : best,
    undefined
  );
  const peakSlot =
    data.dailyRevenue.length === 0
      ? t('dashboard.pendingData', { ns: 'manager' })
      : data.dailyRevenue
          .reduce((best, day) => (day.orders > best.orders ? day : best))
          .date.slice(5);

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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            {t('dashboard.analytics')}
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">{t('dashboard.congestionTrend')}</h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">{peakSlot}</p>
          <p className="mt-2 text-sm text-gray-500">{t('dashboard.busiestDay')}</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 font-bold text-gray-950">{t('dashboard.salesLastSevenDays')}</h2>
        {data.dailyRevenue.length === 0 ? (
          <p className="text-sm text-gray-400">{t('states.empty', { ns: 'common' })}</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {data.dailyRevenue.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full bg-brand-500 rounded-t"
                  style={{ height: `${Math.round((d.revenue / maxRevenue) * 100)}%`, minHeight: 4 }}
                  title={formatMoney(d.revenue)}
                />
                <span className="text-[10px] text-gray-400 truncate w-full text-center">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
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
                <th className="pb-2 font-medium">{t('labels.product', { ns: 'common' })}</th>
                <th className="pb-2 font-medium text-right">{t('dashboard.salesCount')}</th>
                <th className="pb-2 font-medium text-right">{t('dashboard.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{p.product_name}</td>
                  <td className="py-2 text-right text-gray-600">{p.total_sold}</td>
                  <td className="py-2 text-right text-gray-800">{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 font-bold text-gray-950">{t('dashboard.recentOrders')}</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">{t('states.empty', { ns: 'common' })}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">{t('dashboard.orderNumber')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.customer')}</th>
                  <th className="pb-2 font-medium text-right">
                    {t('labels.total', { ns: 'common' })}
                  </th>
                  <th className="pb-2 font-medium text-right">
                    {t('labels.status', { ns: 'common' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{order.order_number}</td>
                    <td className="py-2 text-gray-600">
                      {order.customer_name ?? t('dashboard.guest', { ns: 'staff' })}
                    </td>
                    <td className="py-2 text-right text-gray-800">{formatMoney(order.subtotal)}</td>
                    <td className="py-2 text-right text-gray-500">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 font-bold text-gray-950">{t('dashboard.recentQueueActivity')}</h2>
          {data.recentQueueActivities.length === 0 ? (
            <p className="text-sm text-gray-400">{t('states.empty', { ns: 'common' })}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">{t('dashboard.ticketNumber')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.queue')}</th>
                  <th className="pb-2 font-medium">{t('dashboard.orderNumber')}</th>
                  <th className="pb-2 font-medium text-right">
                    {t('labels.status', { ns: 'common' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentQueueActivities.map((activity) => (
                  <tr key={activity.entry_id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{activity.ticket_code}</td>
                    <td className="py-2 text-gray-600">{activity.queue_name}</td>
                    <td className="py-2 text-gray-600">{activity.order_number ?? '-'}</td>
                    <td className="py-2 text-right text-gray-500">{activity.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
