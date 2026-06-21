import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { get, patch, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: string;
  service_time_minutes: number;
  quantity: number;
  subtotal: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  subtotal: string;
  payment_status: string;
  ticket_code: string | null;
  queue_entry_status: string | null;
  created_at: string;
  items: OrderItem[];
}

interface QueueEntry {
  id: string;
  ticket_code: string;
  status: string;
  order: Order | null;
}

interface MyQueueOverview {
  queueId: string | null;
  queueName: string | null;
  waitingCount: number;
  waitingEntriesWithOrders: QueueEntry[];
  calledEntryWithOrder: QueueEntry | null;
  servingEntryWithOrder: QueueEntry | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang làm',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const QUEUE_STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-700',
  called: 'bg-orange-100 text-orange-700',
  serving: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-700',
};

const QUEUE_STATUS_LABELS: Record<string, string> = {
  waiting: 'Chờ',
  called: 'Đã gọi',
  serving: 'Đang phục vụ',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  no_show: 'Vắng mặt',
};

function formatCurrency(n: string | number) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

export function StaffDashboardPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Unified queue + orders endpoint
  const { data: queueData, isLoading: queueLoading } = useQuery<MyQueueOverview>({
    queryKey: ['staff-my-queue', orgId],
    queryFn: () => get<MyQueueOverview>('/api/v1/staff/my-queue'),
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  // Build combined list: serving → called → waiting
  const allEntries: QueueEntry[] = [
    ...(queueData?.servingEntryWithOrder ? [queueData.servingEntryWithOrder] : []),
    ...(queueData?.calledEntryWithOrder ? [queueData.calledEntryWithOrder] : []),
    ...(queueData?.waitingEntriesWithOrders ?? []),
  ];

  const selectedEntry = allEntries.find((e) => e.id === selectedEntryId) ?? allEntries[0] ?? null;

  const invalidateQueue = () => queryClient.invalidateQueries({ queryKey: ['staff-my-queue', orgId] });

  // Queue actions
  const callNextMutation = useMutation({
    mutationFn: () => post(`/api/v1/staff/queues/${queueData?.queueId}/call-next`, {}),
    onSuccess: invalidateQueue,
  });
  const serveMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/serve`, {}),
    onSuccess: invalidateQueue,
  });
  const completeMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/complete`, {}),
    onSuccess: invalidateQueue,
  });
  const noShowMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/no-show`, {}),
    onSuccess: invalidateQueue,
  });
  const cancelEntryMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/cancel`, {}),
    onSuccess: invalidateQueue,
  });

  // Order actions
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patch(`/api/v1/orders/${id}/status`, { status }),
    onSuccess: invalidateQueue,
  });
  const paymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      patch(`/api/v1/orders/${id}/payment`, { paymentStatus }),
    onSuccess: invalidateQueue,
  });

  const isLoading = queueLoading;
  const selected = selectedEntry;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar: queue entries */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Queue header + Call Next */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm">
              {queueData?.queueName ?? 'Hàng đợi'}
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs bg-brand-600 text-white rounded-full">
                {queueData?.waitingCount ?? 0}
              </span>
            </h2>
          </div>
          <button
            onClick={() => callNextMutation.mutate()}
            disabled={callNextMutation.isPending || !queueData?.queueId || (queueData?.waitingCount ?? 0) === 0}
            className="w-full py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors font-medium"
          >
            {callNextMutation.isPending ? 'Đang gọi...' : '📣 Gọi số tiếp theo'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-gray-400 text-sm px-4 py-6 text-center">Đang tải...</p>}
          {!isLoading && allEntries.length === 0 && (
            <p className="text-gray-400 text-sm px-4 py-6 text-center">Không có khách.</p>
          )}
          {allEntries.map((entry) => {
            const ord = entry.order;
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selected?.id === entry.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-gray-800">{entry.ticket_code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${QUEUE_STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {QUEUE_STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                </div>
                {ord ? (
                  <>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{ord.customer_name ?? 'Khách lẻ'}</p>
                    <p className="text-sm font-medium text-gray-700 mt-0.5">{formatCurrency(ord.subtotal)}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Không có đơn</p>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main: selected entry detail */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Chọn số thứ tự để xem chi tiết
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Ticket + queue status header */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Số thứ tự</p>
                <p className="text-4xl font-bold font-mono text-gray-900">{selected.ticket_code}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${QUEUE_STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {QUEUE_STATUS_LABELS[selected.status] ?? selected.status}
                </span>
                {selected.order && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selected.order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {selected.order.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                  </span>
                )}
              </div>
            </div>

            {/* Customer info */}
            {selected.order && (
              <div className="text-sm text-gray-600 space-y-0.5">
                <p>Khách: <span className="font-medium text-gray-800">{selected.order.customer_name ?? 'Khách lẻ'}</span></p>
                {selected.order.customer_phone && (
                  <p>SĐT: <span className="font-medium text-gray-800">{selected.order.customer_phone}</span></p>
                )}
              </div>
            )}

            {/* Queue action buttons */}
            <div className="flex flex-wrap gap-2">
              {selected.status === 'called' && (
                <>
                  <button
                    onClick={() => serveMutation.mutate(selected.id)}
                    disabled={serveMutation.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    ✅ Bắt đầu phục vụ
                  </button>
                  <button
                    onClick={() => noShowMutation.mutate(selected.id)}
                    disabled={noShowMutation.isPending}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                  >
                    🚫 Vắng mặt
                  </button>
                </>
              )}
              {selected.status === 'serving' && (
                <button
                  onClick={() => completeMutation.mutate(selected.id)}
                  disabled={completeMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  ✔ Hoàn thành
                </button>
              )}
              {['waiting', 'called'].includes(selected.status) && (
                <button
                  onClick={() => {
                    if (confirm('Xác nhận huỷ số này?')) cancelEntryMutation.mutate(selected.id);
                  }}
                  disabled={cancelEntryMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Huỷ số
                </button>
              )}
            </div>

            {/* Items table — show if entry has an order */}
            {selected.order ? (
              (() => {
                const order = selected.order;
                return (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">Đơn hàng {order.order_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
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
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {item.product_name}
                          <span className="ml-1 text-xs text-gray-400">({item.service_time_minutes}ph)</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.product_price)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-700">Tổng cộng</td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                        {formatCurrency(order.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Order-level payment toggle */}
                {['pending', 'processing'].includes(order.status) && (
                  <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => paymentMutation.mutate({
                        id: order.id,
                        paymentStatus: order.payment_status === 'paid' ? 'unpaid' : 'paid',
                      })}
                      disabled={paymentMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        order.payment_status === 'paid'
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      } disabled:opacity-50`}
                    >
                      {order.payment_status === 'paid' ? 'Bỏ thanh toán' : '💰 Đánh dấu đã thanh toán'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Huỷ đơn hàng này?')) statusMutation.mutate({ id: order.id, status: 'cancelled' });
                      }}
                      disabled={statusMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Huỷ đơn
                    </button>
                  </div>
                )}
              </div>
                );
              })()
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                Không có đơn hàng liên kết với số này.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
