import { useQuery } from '@tanstack/react-query';

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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMinutes(seconds: number) {
  return `${Math.ceil(seconds / 60)} 分`;
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
    return <div className="text-gray-400 text-sm">読み込み中...</div>;
  }

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
      ? 'データ待ち'
      : data.dailyRevenue
          .reduce((best, day) => (day.orders > best.orders ? day : best))
          .date.slice(5);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">管理</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">ダッシュボード</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="売上合計" value={formatCurrency(data.totalRevenue)} />
        <StatCard label="注文合計" value={String(data.totalOrders)} />
        <StatCard label="完了した注文" value={String(data.completedOrders)} />
        <StatCard label="キャンセル注文" value={String(data.cancelledOrders)} />
        <StatCard label="キャンセル率" value={`${cancellationRate}%`} />
        <StatCard
          label="処理中の注文"
          value={String(data.pendingOrders)}
          sub={`${data.totalProducts} 商品/サービス`}
        />
        <StatCard label="待機中の顧客" value={String(data.activeQueueEntries)} />
        <StatCard label="平均ETA" value={formatMinutes(data.averageEtaSeconds)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            実績ベース予測
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">待ち時間の目安</h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">
            {waitForecast ? formatMinutes(waitForecast.forecasted_wait_seconds) : 'データ待ち'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {waitForecast?.explanation ?? '次回の集計後に表示します。'}
          </p>
          {waitForecast && (
            <p className="mt-2 text-xs text-gray-400">
              信頼度 {Math.round(Number(waitForecast.confidence) * 100)}% ·{' '}
              {waitForecast.model_version}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            シフト提案
          </p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">推奨スタッフ数</h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">
            {recommendedSlot ? `${recommendedSlot.recommended_staff_count} 名` : 'データ待ち'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {recommendedSlot?.explanation ?? '次回の集計後に表示します。'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">分析</p>
          <h2 className="mt-2 text-lg font-bold text-gray-950">混雑傾向</h2>
          <p className="mt-4 text-3xl font-bold text-gray-950">{peakSlot}</p>
          <p className="mt-2 text-sm text-gray-500">直近7日間で注文数が多い日</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 font-bold text-gray-950">直近7日間の売上</h2>
        {data.dailyRevenue.length === 0 ? (
          <p className="text-sm text-gray-400">データがありません</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {data.dailyRevenue.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full bg-brand-500 rounded-t"
                  style={{ height: `${Math.round((d.revenue / maxRevenue) * 100)}%`, minHeight: 4 }}
                  title={formatCurrency(d.revenue)}
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
        <h2 className="mb-3 font-bold text-gray-950">商品 / サービス Top 5</h2>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">データがありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">商品</th>
                <th className="pb-2 font-medium text-right">販売数</th>
                <th className="pb-2 font-medium text-right">売上</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800">{p.product_name}</td>
                  <td className="py-2 text-right text-gray-600">{p.total_sold}</td>
                  <td className="py-2 text-right text-gray-800">{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 font-bold text-gray-950">最近の注文</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">データがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">注文番号</th>
                  <th className="pb-2 font-medium">顧客</th>
                  <th className="pb-2 font-medium text-right">合計</th>
                  <th className="pb-2 font-medium text-right">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{order.order_number}</td>
                    <td className="py-2 text-gray-600">{order.customer_name ?? 'ゲスト顧客'}</td>
                    <td className="py-2 text-right text-gray-800">
                      {formatCurrency(order.subtotal)}
                    </td>
                    <td className="py-2 text-right text-gray-500">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 font-bold text-gray-950">最近のキュー活動</h2>
          {data.recentQueueActivities.length === 0 ? (
            <p className="text-sm text-gray-400">データがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">番号</th>
                  <th className="pb-2 font-medium">キュー</th>
                  <th className="pb-2 font-medium">注文</th>
                  <th className="pb-2 font-medium text-right">ステータス</th>
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
