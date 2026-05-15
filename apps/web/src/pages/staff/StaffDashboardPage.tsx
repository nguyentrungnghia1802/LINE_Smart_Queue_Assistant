import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { get, patch } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: string;
  quantity: number;
  subtotal: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  status: string;
  subtotal: string;
  payment_status: string;
  created_at: string;
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang làm',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatCurrency(n: string | number) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

export function StaffDashboardPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders-staff', orgId],
    queryFn: () => get<Order[]>('/api/v1/orders'),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });

  const activeOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing');
  const selected = orders.find((o) => o.id === selectedId) ?? activeOrders[0] ?? null;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patch(`/api/v1/orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders-staff', orgId] }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      patch(`/api/v1/orders/${id}/payment`, { paymentStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders-staff', orgId] }),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar: order list */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">
            Đơn đang chờ
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-brand-600 text-white rounded-full">
              {activeOrders.length}
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="text-gray-400 text-sm px-4 py-6 text-center">Đang tải...</p>
          )}
          {!isLoading && activeOrders.length === 0 && (
            <p className="text-gray-400 text-sm px-4 py-6 text-center">Không có đơn nào.</p>
          )}
          {activeOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                (selected?.id === order.id) ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-800">{order.order_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate">
                {order.customer_name ?? 'Khách lẻ'}
              </p>
              <p className="text-sm font-medium text-gray-700 mt-0.5">
                {formatCurrency(order.subtotal)}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main: selected order detail */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Chọn đơn hàng để xem chi tiết
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Số đơn</p>
                <p className="text-4xl font-bold font-mono text-gray-900">{selected.order_number}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${selected.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {selected.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Khách: <span className="font-medium text-gray-800">{selected.customer_name ?? 'Khách lẻ'}</span>
            </div>

            {/* Items table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Sản phẩm</th>
                    <th className="px-4 py-2 text-right">SL</th>
                    <th className="px-4 py-2 text-right">Đơn giá</th>
                    <th className="px-4 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.product_name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.product_price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-700">
                      Tổng cộng
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                      {formatCurrency(selected.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Action buttons */}
            {(selected.status === 'pending' || selected.status === 'processing') && (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => paymentMutation.mutate({
                    id: selected.id,
                    paymentStatus: selected.payment_status === 'paid' ? 'unpaid' : 'paid',
                  })}
                  disabled={paymentMutation.isPending}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selected.payment_status === 'paid'
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {selected.payment_status === 'paid' ? 'Bỏ thanh toán' : 'Đánh dấu Đã thanh toán'}
                </button>

                {selected.status === 'pending' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: selected.id, status: 'processing' })}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Bắt đầu làm
                  </button>
                )}

                <button
                  onClick={() => statusMutation.mutate({ id: selected.id, status: 'completed' })}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  Hoàn thành
                </button>

                <button
                  onClick={() => {
                    if (confirm('Xác nhận huỷ đơn này?')) {
                      statusMutation.mutate({ id: selected.id, status: 'cancelled' });
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Huỷ đơn
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
