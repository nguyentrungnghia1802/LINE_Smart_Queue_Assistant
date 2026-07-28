import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock3, Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatDateTime } from '../../i18n/format';
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

  const historyOrders = history.data.items.flatMap((group) =>
    group.orders.map((order) => ({ group, order }))
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-950">
          {t('history.title', { ns: 'customer' })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('history.statusHint', { ns: 'customer' })}</p>
      </div>

      <div className="space-y-2">
        {historyOrders.map(({ group, order }, index) => {
          const content = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-600">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-bold text-gray-950">
                    {order.order_number}
                  </span>
                  {order.ticket && (
                    <span className="text-xs font-medium text-gray-500">
                      {t('labels.ticketCode', { ns: 'common' })} {order.ticket.ticket_code}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {order.branch_name_snapshot || group.organization_name}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDateTime(order.created_at, i18n.resolvedLanguage ?? 'ja')}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <p className="font-semibold text-gray-700">
                  {ORDER_STATUS[order.status]
                    ? t(ORDER_STATUS[order.status], { ns: 'common' })
                    : order.status}
                </p>
                <p className="mt-0.5 text-gray-500">
                  {PAYMENT_STATUS[order.payment_status]
                    ? t(PAYMENT_STATUS[order.payment_status], { ns: 'common' })
                    : order.payment_status}
                </p>
              </div>
              {order.ticket && (
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
              )}
            </>
          );

          return order.ticket ? (
            <button
              key={order.id}
              type="button"
              onClick={() =>
                navigate(`/liff/tickets/${order.ticket?.id}`, {
                  state: { from: '/liff/history' },
                })
              }
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-line-green/40 hover:bg-gray-50"
              aria-label={t('history.viewDetails', {
                ns: 'customer',
                number: order.order_number,
              })}
            >
              {content}
            </button>
          ) : (
            <article
              key={order.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3"
            >
              {content}
            </article>
          );
        })}
      </div>

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
