import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { get, patch, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrderItem {
  id: string;
  product_name: string;
  product_image_url?: string | null;
  product_price: string;
  service_time_minutes: number;
  quantity: number;
  subtotal: string;
  payment_status?: string;
  prepaid_amount?: string;
  requires_prepayment_snapshot?: boolean;
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
  pending: '処理待ち',
  processing: '処理中',
  completed: '完了',
  cancelled: 'キャンセル済み',
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
  waiting: '待機中',
  called: '呼び出し済み',
  serving: '対応中',
  completed: '完了',
  cancelled: 'キャンセル済み',
  no_show: '不在',
};

function formatCurrency(n: string | number) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function printReceipt(order: Order, ticketCode: string) {
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>${item.product_name}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatCurrency(item.product_price)}</td>
          <td class="right">${formatCurrency(item.subtotal)}</td>
        </tr>`
    )
    .join('');
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>領収書 ${order.order_number}</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          .meta { color: #6b7280; font-size: 12px; line-height: 1.7; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 0; text-align: left; }
          .right { text-align: right; }
          .total { font-size: 18px; font-weight: 700; text-align: right; margin-top: 18px; }
          .paid { display: inline-block; margin-top: 12px; padding: 6px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>領収書</h1>
        <div class="meta">
          注文番号: ${order.order_number}<br />
          受付番号: ${ticketCode}<br />
          顧客: ${order.customer_name ?? 'ゲスト顧客'}<br />
          発行日時: ${new Date().toLocaleString('ja-JP')}
        </div>
        <table>
          <thead>
            <tr><th>商品</th><th class="right">数量</th><th class="right">単価</th><th class="right">小計</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">合計 ${formatCurrency(order.subtotal)}</div>
        <span class="paid">支払い済み</span>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
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

  const invalidateQueue = () =>
    queryClient.invalidateQueries({ queryKey: ['staff-my-queue', orgId] });

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
    <div className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-row overflow-hidden bg-[var(--app-bg)]">
      {/* Left sidebar: queue entries */}
      <aside className="flex w-24 shrink-0 flex-col border-r border-gray-200 bg-white sm:w-80">
        {/* Queue header + Call Next */}
        <div className="space-y-2 border-b border-gray-100 px-2 py-3 sm:px-4">
          <div className="flex items-center justify-center sm:justify-between">
            <h2 className="text-center text-xs font-semibold text-gray-700 sm:text-left sm:text-sm">
              <span className="hidden sm:inline">{queueData?.queueName ?? 'キュー'}</span>
              <span className="sm:hidden">待ち</span>
              <span className="mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-white sm:ml-2 sm:mt-0 sm:h-5 sm:min-w-5">
                {queueData?.waitingCount ?? 0}
              </span>
            </h2>
          </div>
          <button
            onClick={() => callNextMutation.mutate()}
            disabled={
              callNextMutation.isPending ||
              !queueData?.queueId ||
              (queueData?.waitingCount ?? 0) === 0
            }
            className="w-full rounded-xl bg-brand-600 px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            <span className="hidden sm:inline">
              {callNextMutation.isPending ? '呼び出し中...' : '次の番号を呼び出す'}
            </span>
            <span className="sm:hidden">{callNextMutation.isPending ? '...' : '呼出'}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="text-gray-400 text-sm px-4 py-6 text-center">読み込み中...</p>
          )}
          {!isLoading && allEntries.length === 0 && (
            <p className="text-gray-400 text-sm px-4 py-6 text-center">顧客はいません。</p>
          )}
          {allEntries.map((entry) => {
            const ord = entry.order;
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`w-full border-b border-gray-50 px-2 py-3 text-left transition-colors hover:bg-gray-50 sm:px-4 ${
                  selected?.id === entry.id
                    ? 'border-l-4 border-l-brand-500 bg-brand-50 pl-1 sm:pl-3'
                    : ''
                }`}
              >
                <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
                  <span className="font-mono text-sm font-bold text-gray-800 sm:text-base">
                    {entry.ticket_code}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-xs ${QUEUE_STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    <span className="hidden sm:inline">
                      {QUEUE_STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span className="sm:hidden">{entry.status.slice(0, 1).toUpperCase()}</span>
                  </span>
                </div>
                {ord ? (
                  <div className="hidden sm:block">
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {ord.customer_name ?? 'ゲスト顧客'}
                    </p>
                    <p className="text-sm font-medium text-gray-700 mt-0.5">
                      {formatCurrency(ord.subtotal)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-0.5 hidden text-xs text-gray-400 sm:block">注文なし</p>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main: selected entry detail */}
      <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            受付番号を選択して詳細を表示
          </div>
        ) : (
          <div className="w-full space-y-5">
            {/* Ticket + queue status header */}
            <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">受付番号</p>
                  <p className="font-mono text-3xl font-bold text-gray-900 sm:text-4xl">
                    {selected.ticket_code}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-col sm:items-end sm:gap-1">
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-medium ${QUEUE_STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    {QUEUE_STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                  {selected.order && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${selected.order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                    >
                      {selected.order.payment_status === 'paid' ? '支払い済み' : '未払い'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                {/* Customer info */}
                {selected.order && (
                  <div className="grid gap-3 rounded-2xl border border-white/80 bg-white p-4 text-sm text-gray-600 shadow-[var(--shadow-soft)] sm:grid-cols-2 sm:p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        顧客
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {selected.order.customer_name ?? 'ゲスト顧客'}
                      </p>
                    </div>
                    {selected.order.customer_phone && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          電話
                        </p>
                        <p className="mt-1 font-bold text-gray-900">
                          {selected.order.customer_phone}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Items table — show if entry has an order */}
                {selected.order ? (
                  (() => {
                    const order = selected.order;
                    return (
                      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
                        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs font-medium uppercase text-gray-500">
                            注文 {order.order_number}
                          </span>
                          <span
                            className={`w-fit rounded-full px-2 py-0.5 text-xs ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </div>
                        <div className="grid gap-3 p-4 xl:grid-cols-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[64px_1fr] gap-3 rounded-2xl border border-gray-100 bg-white p-3 sm:grid-cols-[72px_1fr_auto] xl:grid-cols-[72px_1fr]"
                            >
                              {item.product_image_url ? (
                                <img
                                  src={item.product_image_url}
                                  alt={item.product_name}
                                  className="h-16 w-16 rounded-xl object-cover sm:h-[72px] sm:w-[72px]"
                                />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-lg font-bold text-gray-400 sm:h-[72px] sm:w-[72px]">
                                  {item.product_name.slice(0, 1)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-bold text-gray-950">
                                    {item.product_name}
                                  </p>
                                  {item.payment_status === 'paid' && (
                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                                      支払い済み
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  {item.service_time_minutes}分 ·{' '}
                                  {formatCurrency(item.product_price)} x {item.quantity}
                                </p>
                              </div>
                              <div className="col-span-2 flex items-center justify-between border-t border-gray-100 pt-3 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right xl:col-span-2 xl:flex xl:border-t xl:pt-3">
                                <span className="text-xs font-semibold text-gray-400 xl:inline">
                                  小計
                                </span>
                                <span className="font-bold text-gray-950">
                                  {formatCurrency(item.subtotal)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-4">
                          <span className="font-semibold text-gray-700">合計</span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(order.subtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                    この受付番号に紐づく注文はありません。
                  </div>
                )}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                {selected.order && (
                  <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      会計
                    </p>
                    <p className="mt-2 text-3xl font-black text-gray-950">
                      {formatCurrency(selected.order.subtotal)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          selected.order.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {selected.order.payment_status === 'paid' ? '支払い済み' : '未払い'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          ORDER_STATUS_COLORS[selected.order.status] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[selected.order.status] ?? selected.order.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Queue action buttons */}
                <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    受付操作
                  </p>
                  <div className="mt-4 grid gap-2">
                    {selected.status === 'called' && (
                      <>
                        <button
                          onClick={() => serveMutation.mutate(selected.id)}
                          disabled={serveMutation.isPending}
                          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          対応開始
                        </button>
                        <button
                          onClick={() => noShowMutation.mutate(selected.id)}
                          disabled={noShowMutation.isPending}
                          className="rounded-xl bg-orange-100 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                        >
                          不在
                        </button>
                      </>
                    )}
                    {selected.status === 'serving' && (
                      <button
                        onClick={() => completeMutation.mutate(selected.id)}
                        disabled={completeMutation.isPending}
                        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        完了
                      </button>
                    )}
                    {['waiting', 'called'].includes(selected.status) && (
                      <button
                        onClick={() => {
                          if (confirm('この受付番号をキャンセルしますか？'))
                            cancelEntryMutation.mutate(selected.id);
                        }}
                        disabled={cancelEntryMutation.isPending}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        受付をキャンセル
                      </button>
                    )}
                  </div>
                </div>

                {selected.order &&
                  (() => {
                    const order = selected.order;
                    return (
                      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          注文操作
                        </p>
                        {['pending', 'processing'].includes(order.status) && (
                          <div className="mt-4 grid gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                paymentMutation.mutate({
                                  id: order.id,
                                  paymentStatus:
                                    order.payment_status === 'paid' ? 'unpaid' : 'paid',
                                })
                              }
                              disabled={paymentMutation.isPending}
                              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                                order.payment_status === 'paid'
                                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              } disabled:opacity-50`}
                            >
                              {order.payment_status === 'paid'
                                ? '支払いを取り消す'
                                : '支払い済みにする'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('この注文をキャンセルしますか？'))
                                  statusMutation.mutate({
                                    id: order.id,
                                    status: 'cancelled',
                                  });
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                            >
                              注文をキャンセル
                            </button>
                          </div>
                        )}
                        {order.payment_status === 'paid' && (
                          <button
                            type="button"
                            onClick={() => printReceipt(order, selected.ticket_code)}
                            className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            領収書を印刷
                          </button>
                        )}
                      </div>
                    );
                  })()}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
