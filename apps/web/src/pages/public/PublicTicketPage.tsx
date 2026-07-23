import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { StandalonePageTopBar } from '../../components/layout/StandalonePageTopBar';
import { formatCurrency } from '../../i18n/format';
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

const STATUS_STYLES: Record<string, { color: string; icon: string }> = {
  waiting: { color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  called: {
    color: 'bg-green-100 text-green-800',
    icon: '📢',
  },
  serving: { color: 'bg-blue-100 text-blue-800', icon: '✅' },
  completed: { color: 'bg-gray-100 text-gray-800', icon: '✔️' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: '❌' },
  no_show: { color: 'bg-orange-100 text-orange-800', icon: '🚫' },
};

export function PublicTicketPage() {
  const { t, i18n } = useTranslation(['customer', 'common']);
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
      <div className="min-h-screen bg-gray-50">
        <StandalonePageTopBar contentClassName="max-w-md" />
        <div className="flex items-center justify-center px-4 py-16">
          <p className="text-gray-500">{t('states.loading', { ns: 'common' })}</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StandalonePageTopBar contentClassName="max-w-md" />
        <div className="flex items-center justify-center px-4 py-16">
          <div className="text-center">
            <p className="mb-2 text-2xl">😕</p>
            <p className="font-medium text-gray-700">{t('ticket.notFound', { ns: 'customer' })}</p>
          </div>
        </div>
      </div>
    );
  }

  const { entry, order, aheadCount, estimatedWaitSeconds, queueName } = data;
  const statusInfo = STATUS_STYLES[entry.status] ?? {
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
  };
  const isCalled = entry.status === 'called';
  const isActive = ['waiting', 'called'].includes(entry.status);
  const canCancel = isActive && order && ['pending', 'processing'].includes(order.status);
  const waitMinutes = Math.ceil((estimatedWaitSeconds ?? 0) / 60);
  const waitLabel =
    !estimatedWaitSeconds || estimatedWaitSeconds <= 0
      ? t('units.soon', { ns: 'common' })
      : t('units.approximateMinutes', { ns: 'common', count: waitMinutes });

  return (
    <div className="min-h-screen bg-gray-50">
      <StandalonePageTopBar contentClassName="max-w-md" />
      <div className="mx-auto w-full max-w-sm px-4 py-8">
        <div className="space-y-5">
          <div className="text-center">
            <span className="text-5xl">🟢</span>
            <h1 className="mt-3 text-xl font-bold text-gray-900">{queueName}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('ticket.yourTicket', { ns: 'customer' })}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-8 text-center shadow-sm ${isCalled ? 'animate-pulse border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
          >
            <p className="text-7xl font-black text-brand-600">{entry.ticket_code}</p>
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${statusInfo.color}`}
            >
              <span>{statusInfo.icon}</span>
              {t(`states.${entry.status === 'no_show' ? 'noShow' : entry.status}`, {
                ns: 'common',
                defaultValue: entry.status,
              })}
            </div>
          </div>

          {isActive && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-gray-800">{aheadCount}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('labels.peopleAhead', { ns: 'common' })}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                <p className="text-base font-bold text-gray-800">{waitLabel}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('labels.estimatedWait', { ns: 'common' })}
                </p>
              </div>
            </div>
          )}

          {isCalled && (
            <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4 text-center">
              <p className="text-lg font-bold text-green-800">
                📢 {t('ticket.goCounter', { ns: 'customer' })}
              </p>
              <p className="mt-1 text-sm text-green-700">
                {t('ticket.calledDescription', { ns: 'customer' })}
              </p>
            </div>
          )}

          {order && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">
                  {t('ticket.orderNumber', { ns: 'customer', number: order.order_number })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                >
                  {order.payment_status === 'paid'
                    ? `✓ ${t('states.paid', { ns: 'common' })}`
                    : t('states.unpaid', { ns: 'common' })}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <span className="text-gray-700">
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="font-medium text-gray-800">
                      {formatCurrency(Number(item.subtotal), i18n.resolvedLanguage ?? 'ja')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <span className="font-semibold text-gray-700">
                  {t('labels.total', { ns: 'common' })}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(Number(order.subtotal), i18n.resolvedLanguage ?? 'ja')}
                </span>
              </div>
            </div>
          )}

          <Link
            to="/customer"
            className="block w-full rounded-xl bg-[#06C755] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#05b54c] focus:outline-none focus:ring-4 focus:ring-[#06C755]/20"
          >
            {t('actions.back', { ns: 'common' })}
          </Link>

          {canCancel && (
            <button
              onClick={() => {
                if (confirm(t('ticket.cancelConfirm', { ns: 'customer' }))) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="w-full rounded-xl border border-red-200 bg-white/40 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50/60 disabled:opacity-50"
            >
              {cancelMutation.isPending
                ? t('ticket.cancelling', { ns: 'customer' })
                : t('ticket.cancelOrder', { ns: 'customer' })}
            </button>
          )}

          <p className="text-center text-xs text-gray-400">
            {t('ticket.autoRefresh', { ns: 'customer' })}
          </p>
        </div>
      </div>
    </div>
  );
}
