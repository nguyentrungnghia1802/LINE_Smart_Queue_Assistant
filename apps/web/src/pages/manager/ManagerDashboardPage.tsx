import { useQuery } from '@tanstack/react-query';

import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface StatsData {
  totalRevenue: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalProducts: number;
  currentQueueDepth: number;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ product_name: string; total_sold: number; revenue: number }>;
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN') + '₫';
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
  const successRate =
    data.completedOrders + data.cancelledOrders > 0
      ? Math.round((data.completedOrders / (data.completedOrders + data.cancelledOrders)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tổng doanh thu" value={formatCurrency(data.totalRevenue)} />
        <StatCard label="Đơn hoàn thành" value={String(data.completedOrders)} />
        <StatCard label="Tỉ lệ thành công" value={`${successRate}%`} />
        <StatCard
          label="Đang chờ"
          value={String(data.pendingOrders)}
          sub={`${data.currentQueueDepth} trong hàng đợi`}
        />
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Sản phẩm bán chạy</h2>
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
    </div>
  );
}
