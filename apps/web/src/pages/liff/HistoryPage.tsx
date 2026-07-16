import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatCurrency, formatDateTime } from '../../i18n/format';
import { bookingGroupsApi } from '../../services/bookingGroups.api';

const ORDER_STATUS: Record<string, string> = {
  pending: 'states.pending',
  processing: 'states.processing',
  completed: 'states.completed',
  cancelled: 'states.cancelled',
};

const PAYMENT_STATUS: Record<string, string> = {
  unpaid: 'states.unpaid',
  pending: 'states.pending',
  authorized: 'states.pending',
  paid: 'states.paid',
  failed: 'states.failed',
  cancelled: 'states.cancelled',
  refunded: 'states.refunded',
};

export function HistoryPage() {
  const { t, i18n } = useTranslation(['customer', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['booking-groups', 'me', page],
    queryFn: () => bookingGroupsApi.listMine(page),
  });

  if (history.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        {t('states.loading', { ns: 'common' })}
      </p>
    );
  }
  if (history.isError) {
    return (
      <ErrorState
        message={t('history.loadFailed', { ns: 'customer' })}
        onRetry={() => void history.refetch()}
      />
    );
  }
  if (!history.data?.items.length) {
    return (
      <div className="max-w-md mx-auto">
        <EmptyState
          icon={t('history.icon', { ns: 'customer' })}
          title={t('history.empty', { ns: 'customer' })}
          message={t('history.description', { ns: 'customer' })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-950">
          {t('history.title', { ns: 'customer' })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('history.statusHint', { ns: 'customer' })}</p>
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
                {formatDateTime(group.created_at, i18n.resolvedLanguage ?? 'ja')}
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {t('units.items', { ns: 'common', count: group.orders.length })}
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {group.orders.map((order) => (
              <article key={order.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">
                      {t('history.orderNumber', { ns: 'customer' })}
                    </p>
                    <p className="font-mono font-bold text-gray-900">{order.order_number}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-gray-700">
                      {ORDER_STATUS[order.status]
                        ? t(ORDER_STATUS[order.status], { ns: 'common' })
                        : order.status}
                    </p>
                    <p className="text-gray-500">
                      {PAYMENT_STATUS[order.payment_status]
                        ? t(PAYMENT_STATUS[order.payment_status], { ns: 'common' })
                        : order.payment_status}
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
                        {formatCurrency(Number(item.subtotal), i18n.resolvedLanguage ?? 'ja')}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                  <strong className="text-sm text-gray-900">
                    {formatCurrency(Number(order.subtotal), i18n.resolvedLanguage ?? 'ja')}
                  </strong>
                  {order.ticket && (
                    <button
                      type="button"
                      onClick={() => navigate(`/liff/tickets/${order.ticket?.id}`)}
                      className="rounded-md bg-line-green px-3 py-2 text-xs font-bold text-white"
                    >
                      {t('history.openTicket', {
                        ns: 'customer',
                        ticket: order.ticket.ticket_code,
                      })}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {history.data.meta.totalPages > 1 && (
        <nav
          aria-label={t('history.pageLabel', { ns: 'customer' })}
          className="flex items-center justify-between"
        >
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            {t('history.previous', { ns: 'customer' })}
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
            {t('history.next', { ns: 'customer' })}
          </button>
        </nav>
      )}
    </div>
  );
}
