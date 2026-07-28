import { Clock3, MapPin, ReceiptText, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatCurrency, formatDateTime } from '../../i18n/format';
import type { CustomerTicketOrder } from '../../types/queue-entry';
import { StatusBadge } from '../ui/StatusBadge';

interface CustomerOrderDetailsProps {
  order: CustomerTicketOrder;
}

function getPaymentSummary(order: CustomerTicketOrder) {
  const total = Number(order.subtotal);
  const prepaid = order.items.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.prepaid_amount ?? 0) - Number(item.refunded_amount ?? 0)),
    0
  );
  return {
    total,
    prepaid,
    amountDue: order.payment_status === 'paid' ? 0 : Math.max(0, total - prepaid),
  };
}

export function CustomerOrderDetails({ order }: Readonly<CustomerOrderDetailsProps>) {
  const { t, i18n } = useTranslation(['customer', 'common']);
  const locale = i18n.resolvedLanguage ?? 'ja';
  const payment = getPaymentSummary(order);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-line-green/10 text-line-green">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">
              {t('orderDetails.orderNumber', { ns: 'customer' })}
            </p>
            <p className="truncate font-mono text-base font-bold text-gray-950">
              {order.order_number}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="grid gap-3 border-b border-gray-100 px-4 py-3 text-sm sm:grid-cols-3">
        <div className="flex min-w-0 items-start gap-2">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{t('orderDetails.store', { ns: 'customer' })}</p>
            <p className="truncate font-semibold text-gray-800">{order.branch_name_snapshot}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{t('orderDetails.queue', { ns: 'customer' })}</p>
            <p className="truncate font-semibold text-gray-800">{order.queue_name_snapshot}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs text-gray-400">
              {t('orderDetails.orderedAt', { ns: 'customer' })}
            </p>
            <p className="font-semibold text-gray-800">
              {formatDateTime(order.created_at, locale)}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100 px-4">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[56px_minmax(0,1fr)_auto]"
          >
            {item.product_image_url ? (
              <img
                src={item.product_image_url}
                alt={item.product_name}
                className="h-12 w-12 rounded-md object-cover sm:h-14 sm:w-14"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-sm font-bold text-gray-400 sm:h-14 sm:w-14">
                {item.product_name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{item.product_name}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatCurrency(Number(item.product_price), locale)} × {item.quantity}
              </p>
            </div>
            <p className="whitespace-nowrap text-sm font-bold text-gray-900">
              {formatCurrency(Number(item.subtotal), locale)}
            </p>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
        {payment.prepaid > 0 && (
          <div className="flex items-center justify-between text-emerald-700">
            <span>{t('orderDetails.paid', { ns: 'customer' })}</span>
            <strong>{formatCurrency(payment.prepaid, locale)}</strong>
          </div>
        )}
        <div className="flex items-center justify-between text-gray-950">
          <span className="font-semibold">{t('orderDetails.total', { ns: 'customer' })}</span>
          <strong className="text-lg">{formatCurrency(payment.total, locale)}</strong>
        </div>
        {payment.amountDue > 0 && (
          <div className="flex items-center justify-between text-amber-700">
            <span>{t('orderDetails.amountDue', { ns: 'customer' })}</span>
            <strong>{formatCurrency(payment.amountDue, locale)}</strong>
          </div>
        )}
      </footer>
    </section>
  );
}
