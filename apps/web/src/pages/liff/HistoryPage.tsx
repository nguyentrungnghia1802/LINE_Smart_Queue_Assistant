import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { bookingGroupsApi } from '../../services/bookingGroups.api';

const ORDER_STATUS: Record<string, string> = {
  pending: '受付済み',
  processing: '対応中',
  completed: '完了',
  cancelled: 'キャンセル',
};

const PAYMENT_STATUS: Record<string, string> = {
  unpaid: '未払い',
  pending: '支払い確認中',
  authorized: '承認済み',
  paid: '支払い済み',
  failed: '支払い失敗',
  cancelled: '支払い取消',
  refunded: '返金済み',
};

export function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['booking-groups', 'me', page],
    queryFn: () => bookingGroupsApi.listMine(page),
  });

  if (history.isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">履歴を読み込んでいます…</p>;
  }
  if (history.isError) {
    return (
      <ErrorState
        message="予約履歴を読み込めませんでした。"
        onRetry={() => void history.refetch()}
      />
    );
  }
  if (!history.data?.items.length) {
    return (
      <div className="max-w-md mx-auto">
        <EmptyState
          icon="履歴"
          title="予約履歴はまだありません"
          message="予約が完了すると、端末を変えてもLINEアカウントから確認できます。"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-950">予約履歴</h1>
        <p className="mt-1 text-sm text-gray-500">
          注文と受付番号は、それぞれ個別の状態で表示されます。
        </p>
      </div>

      {history.data.items.map((group) => (
        <section
          key={group.id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="font-semibold text-gray-900">{group.organization_name}</h2>
              <p className="text-xs text-gray-500">
                {new Intl.DateTimeFormat('ja-JP', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Tokyo',
                }).format(new Date(group.created_at))}
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500">{group.orders.length}件</span>
          </div>

          <div className="divide-y divide-gray-100">
            {group.orders.map((order) => (
              <article key={order.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">注文番号</p>
                    <p className="font-mono font-bold text-gray-900">{order.order_number}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-gray-700">
                      {ORDER_STATUS[order.status] ?? order.status}
                    </p>
                    <p className="text-gray-500">
                      {PAYMENT_STATUS[order.payment_status] ?? order.payment_status}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-gray-600">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <span>
                        {new Intl.NumberFormat('ja-JP', {
                          style: 'currency',
                          currency: 'JPY',
                          maximumFractionDigits: 0,
                        }).format(Number(item.subtotal))}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                  <strong className="text-sm text-gray-900">
                    {new Intl.NumberFormat('ja-JP', {
                      style: 'currency',
                      currency: 'JPY',
                      maximumFractionDigits: 0,
                    }).format(Number(order.subtotal))}
                  </strong>
                  {order.ticket && (
                    <button
                      type="button"
                      onClick={() => navigate(`/liff/tickets/${order.ticket?.id}`)}
                      className="rounded-md bg-line-green px-3 py-2 text-xs font-bold text-white"
                    >
                      受付番号 {order.ticket.ticket_code} を開く
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {history.data.meta.totalPages > 1 && (
        <nav aria-label="履歴ページ" className="flex items-center justify-between">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            前へ
          </button>
          <span className="text-sm text-gray-500">
            {page} / {history.data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= history.data.meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            次へ
          </button>
        </nav>
      )}
    </div>
  );
}
