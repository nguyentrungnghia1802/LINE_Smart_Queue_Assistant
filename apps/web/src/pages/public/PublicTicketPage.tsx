import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { get, post } from '../../services/apiClient';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: string;
  quantity: number;
  subtotal: string;
}

interface TicketStatus {
  entry: {
    id: string;
    ticket_code: string;
    status: string;
    created_at: string;
  };
  order: {
    id: string;
    order_number: string;
    customer_name: string | null;
    subtotal: string;
    payment_status: string;
    status: string;
    items: OrderItem[];
  } | null;
  aheadCount: number;
  estimatedWaitSeconds: number | null;
  queueName: string;
}

function fmtWait(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'まもなく順番です';
  const m = Math.ceil(seconds / 60);
  return m < 60 ? `~${m} 分` : `~${Math.floor(m / 60)}時間${m % 60} 分`;
}

function formatCurrency(n: string | number) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  waiting: { label: '待機中', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  called: {
    label: '呼び出し中！カウンターへお越しください',
    color: 'bg-green-100 text-green-800',
    icon: '📢',
  },
  serving: { label: '対応中', color: 'bg-blue-100 text-blue-800', icon: '✅' },
  completed: { label: '完了', color: 'bg-gray-100 text-gray-800', icon: '✔️' },
  cancelled: { label: 'キャンセル済み', color: 'bg-red-100 text-red-800', icon: '❌' },
  no_show: { label: '不在', color: 'bg-orange-100 text-orange-800', icon: '🚫' },
};

export function PublicTicketPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<TicketStatus>({
    queryKey: ['ticket-status', entryId],
    queryFn: () => get<TicketStatus>(`/api/v1/queue/entry/${entryId}`),
    refetchInterval: 15_000,
    enabled: !!entryId,
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      const orderId = data?.order?.id;
      if (!orderId) throw new Error('Order not found for cancellation');
      return post(`/api/v1/orders/${orderId}/cancel`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-status', entryId] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-2xl mb-2">😕</p>
          <p className="text-gray-700 font-medium">受付番号が見つかりません。</p>
        </div>
      </div>
    );
  }

  const { entry, order, aheadCount, estimatedWaitSeconds, queueName } = data;
  const statusInfo = STATUS_LABELS[entry.status] ?? {
    label: entry.status,
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
  };
  const isCalled = entry.status === 'called';
  const isActive = ['waiting', 'called'].includes(entry.status);
  const canCancel = isActive && order && ['pending', 'processing'].includes(order.status);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center">
          <span className="text-5xl">🟢</span>
          <h1 className="mt-3 text-xl font-bold text-gray-900">{queueName}</h1>
          <p className="text-sm text-gray-500 mt-1">あなたの受付番号</p>
        </div>

        {/* Ticket number */}
        <div
          className={`rounded-2xl p-8 text-center shadow-sm border ${isCalled ? 'bg-green-50 border-green-300 animate-pulse' : 'bg-white border-gray-200'}`}
        >
          <p className="text-7xl font-black text-brand-600">{entry.ticket_code}</p>
          <div
            className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}
          >
            <span>{statusInfo.icon}</span>
            {statusInfo.label}
          </div>
        </div>

        {/* Status info */}
        {isActive && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{aheadCount}</p>
              <p className="text-xs text-gray-500 mt-1">前の人数</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-base font-bold text-gray-800">{fmtWait(estimatedWaitSeconds)}</p>
              <p className="text-xs text-gray-500 mt-1">待ち時間</p>
            </div>
          </div>
        )}

        {isCalled && (
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
            <p className="text-green-800 font-bold text-lg">📢 カウンターへお越しください</p>
            <p className="text-green-700 text-sm mt-1">
              受付番号が呼び出されました。カウンターへお越しください。
            </p>
          </div>
        )}

        {/* Order summary */}
        {order && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                注文 #{order.order_number}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
              >
                {order.payment_status === 'paid' ? '✓ 支払い済み' : '未払い'}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {item.product_name} × {item.quantity}
                  </span>
                  <span className="font-medium text-gray-800">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <span className="font-semibold text-gray-700">合計</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(order.subtotal)}
              </span>
            </div>
          </div>
        )}

        {/* Cancel button */}
        {canCancel && (
          <button
            onClick={() => {
              if (confirm('注文と受付番号をキャンセルしますか？')) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="w-full py-2.5 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {cancelMutation.isPending ? 'キャンセル中...' : '注文と受付番号をキャンセル'}
          </button>
        )}

        <p className="text-center text-xs text-gray-400">15秒ごとに自動更新</p>
      </div>
    </div>
  );
}
