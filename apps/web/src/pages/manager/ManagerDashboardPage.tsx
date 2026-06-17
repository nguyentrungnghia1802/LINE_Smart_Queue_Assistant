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
    ticket_display: string;
    status: string;
    updated_at: string;
    order_number: string | null;
    customer_name: string | null;
  }>;
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
}

function formatMinutes(seconds: number) {
  return `${Math.ceil(seconds / 60)} phút`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
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

  if (isLoading || !data) {
    return <div className="text-gray-400 text-sm">Đang tải...</div>;
  }

  const maxRevenue = Math.max(...data.dailyRevenue.map((d) => d.revenue), 1);
  const cancellationRate = Math.round(data.cancellationRate * 100);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng doanh thu" value={formatCurrency(data.totalRevenue)} />
        <StatCard label="Tổng đơn" value={String(data.totalOrders)} />
        <StatCard label="Đơn hoàn thành" value={String(data.completedOrders)} />
        <StatCard label="Đơn đã huỷ" value={String(data.cancelledOrders)} />
        <StatCard label="Tỉ lệ huỷ" value={`${cancellationRate}%`} />
        <StatCard
          label="Đơn đang xử lý"
          value={String(data.pendingOrders)}
          sub={`${data.totalProducts} sản phẩm/dịch vụ`}
        />
        <StatCard label="Khách trong hàng" value={String(data.activeQueueEntries)} />
        <StatCard label="ETA trung bình" value={formatMinutes(data.averageEtaSeconds)} />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Doanh thu 7 ngày gần nhất</h2>
        {data.dailyRevenue.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Top 5 sản phẩm / dịch vụ</h2>
        {data.topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Sản phẩm</th>
                <th className="pb-2 font-medium text-right">Đã bán</th>
                <th className="pb-2 font-medium text-right">Doanh thu</th>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Đơn gần đây</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Mã đơn</th>
                  <th className="pb-2 font-medium">Khách</th>
                  <th className="pb-2 font-medium text-right">Tổng</th>
                  <th className="pb-2 font-medium text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{order.order_number}</td>
                    <td className="py-2 text-gray-600">{order.customer_name ?? 'Khách lẻ'}</td>
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

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Hoạt động hàng đợi gần đây</h2>
          {data.recentQueueActivities.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Số</th>
                  <th className="pb-2 font-medium">Queue</th>
                  <th className="pb-2 font-medium">Đơn</th>
                  <th className="pb-2 font-medium text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.recentQueueActivities.map((activity) => (
                  <tr key={activity.entry_id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{activity.ticket_display}</td>
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
