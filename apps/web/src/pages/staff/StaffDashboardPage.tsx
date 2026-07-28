import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { CheckCircle2, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { i18n } from '../../i18n';
import { formatCurrency as formatLocalizedCurrency, formatDateTime } from '../../i18n/format';
import { get, patch, post } from '../../services/apiClient';
import type { BookingGroup } from '../../services/bookingGroups.api';
import { staffApi } from '../../services/staff.api';
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
  refunded_amount?: string;
  requires_prepayment_snapshot?: boolean;
}

interface Order {
  id: string;
  booking_group_id?: string | null;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_line_display_name?: string | null;
  organization_name_snapshot: string;
  branch_name_snapshot: string;
  queue_name_snapshot: string;
  fulfilled_by_name: string | null;
  fulfilled_by_employee_code: string | null;
  fulfilled_at: string | null;
  status: string;
  subtotal: string;
  payment_status: string;
  ticket_code: string | null;
  queue_entry_status: string | null;
  created_at: string;
  items: OrderItem[];
}

interface DisplayOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: string;
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
  availableQueues: Array<{ id: string; name: string }>;
  waitingCount: number;
  totalActiveCount: number;
  waitingEntriesWithOrders: QueueEntry[];
  calledEntryWithOrder: QueueEntry | null;
  servingEntryWithOrder: QueueEntry | null;
}

const MAX_VISIBLE_QUEUE_ENTRIES = 8;

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'states.pending',
  processing: 'states.processing',
  completed: 'states.completed',
  cancelled: 'states.cancelled',
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
  waiting: 'states.waiting',
  called: 'states.called',
  serving: 'states.serving',
  completed: 'states.completed',
  cancelled: 'states.cancelled',
  no_show: 'states.noShow',
};

function formatCurrency(n: string | number) {
  return formatLocalizedCurrency(Number(n), i18n.resolvedLanguage ?? 'ja');
}

interface PaymentSummary {
  total: number;
  prepaid: number;
  requiredPrepaid: number;
  amountDue: number;
}

function summarizeItems(items: OrderItem[]): PaymentSummary {
  return items.reduce<PaymentSummary>(
    (summary, item) => {
      const subtotal = Number(item.subtotal);
      const netPrepaid = Math.max(
        0,
        Number(item.prepaid_amount ?? 0) - Number(item.refunded_amount ?? 0)
      );
      summary.total += subtotal;
      summary.prepaid += netPrepaid;
      if (item.requires_prepayment_snapshot) summary.requiredPrepaid += netPrepaid;
      summary.amountDue += Math.max(0, subtotal - netPrepaid);
      return summary;
    },
    { total: 0, prepaid: 0, requiredPrepaid: 0, amountDue: 0 }
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function PaymentBreakdown({ summary, t }: { summary: PaymentSummary; t: TFunction }) {
  return (
    <div className="space-y-2 border-t border-gray-100 px-4 py-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-600">{t('labels.total', { ns: 'common' })}</span>
        <span className="font-bold text-gray-900">{formatCurrency(summary.total)}</span>
      </div>
      {summary.requiredPrepaid > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-emerald-700">{t('dashboard.prepaidAmount')}</span>
          <span className="font-bold text-emerald-700">
            {formatCurrency(summary.requiredPrepaid)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="font-bold text-gray-950">{t('dashboard.amountDue')}</span>
        <span className="text-xl font-black text-gray-950">
          {formatCurrency(summary.amountDue)}
        </span>
      </div>
    </div>
  );
}

function printReceipt(order: Order, ticketCode: string) {
  const summary = summarizeItems(order.items);
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
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
        <title>${i18n.t('staff:dashboard.printReceipt')} ${order.order_number}</title>
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
        <h1>${i18n.t('staff:dashboard.printReceipt')}</h1>
        <div class="meta">
          ${i18n.t('staff:dashboard.receiptOrganization')}: ${escapeHtml(order.organization_name_snapshot)}<br />
          ${i18n.t('staff:dashboard.receiptBranch')}: ${escapeHtml(order.branch_name_snapshot)}<br />
          ${i18n.t('staff:dashboard.receiptQueue')}: ${escapeHtml(order.queue_name_snapshot)}<br />
          ${i18n.t('staff:dashboard.receiptOrderNumber')}: ${escapeHtml(order.order_number)}<br />
          ${i18n.t('staff:dashboard.receiptTicketNumber')}: ${escapeHtml(ticketCode)}<br />
          ${i18n.t('staff:dashboard.receiptCustomer')}: ${escapeHtml(order.customer_name ?? i18n.t('staff:dashboard.guest'))}<br />
          ${i18n.t('staff:dashboard.receiptStaff')}: ${escapeHtml(order.fulfilled_by_name ?? i18n.t('staff:dashboard.contactUnavailable'))}${order.fulfilled_by_employee_code ? ` (${escapeHtml(order.fulfilled_by_employee_code)})` : ''}<br />
          ${i18n.t('staff:dashboard.receiptOrderedAt')}: ${formatDateTime(order.created_at, i18n.resolvedLanguage ?? 'ja')}<br />
          ${i18n.t('staff:dashboard.receiptFulfilledAt')}: ${formatDateTime(order.fulfilled_at ?? new Date(), i18n.resolvedLanguage ?? 'ja')}
        </div>
        <table>
          <thead>
            <tr><th>${i18n.t('common:labels.product')}</th><th class="right">${i18n.t('common:labels.quantity')}</th><th class="right">${i18n.t('staff:dashboard.receiptUnitPrice')}</th><th class="right">${i18n.t('staff:dashboard.receiptSubtotal')}</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">${i18n.t('common:labels.total')} ${formatCurrency(summary.total)}</div>
        ${summary.requiredPrepaid > 0 ? `<div class="total">${i18n.t('staff:dashboard.prepaidAmount')} ${formatCurrency(summary.requiredPrepaid)}</div>` : ''}
        <div class="total">${i18n.t('staff:dashboard.amountDue')} ${formatCurrency(summary.amountDue)}</div>
        <span class="paid">${i18n.t('common:states.paid')}</span>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

export function StaffDashboardPage() {
  const { t } = useTranslation(['staff', 'common']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [lastCompletedReceipt, setLastCompletedReceipt] = useState<{
    order: Order;
    ticketCode: string;
  } | null>(null);

  // Unified queue + orders endpoint
  const { data: queueData, isLoading: queueLoading } = useQuery<MyQueueOverview>({
    queryKey: ['staff-my-queue', orgId, selectedQueueId],
    queryFn: () =>
      get<MyQueueOverview>(
        `/api/v1/staff/my-queue${selectedQueueId ? `?queueId=${selectedQueueId}` : ''}`
      ),
    enabled: !!orgId,
    refetchInterval: lastCompletedReceipt ? false : 10_000,
  });

  // Build combined list: serving → called → waiting
  const allEntries: QueueEntry[] = [
    ...(queueData?.servingEntryWithOrder ? [queueData.servingEntryWithOrder] : []),
    ...(queueData?.calledEntryWithOrder ? [queueData.calledEntryWithOrder] : []),
    ...(queueData?.waitingEntriesWithOrders ?? []),
  ];
  const visibleEntries = allEntries.slice(0, MAX_VISIBLE_QUEUE_ENTRIES);

  const selectedEntry = allEntries.find((e) => e.id === selectedEntryId) ?? allEntries[0] ?? null;
  const relatedBookings = useQuery<BookingGroup>({
    queryKey: ['staff-booking-group', selectedEntry?.order?.booking_group_id],
    queryFn: () =>
      get<BookingGroup>(`/api/v1/booking-groups/${selectedEntry?.order?.booking_group_id}`),
    enabled: Boolean(selectedEntry?.order?.booking_group_id),
  });
  const activeRelatedOrders =
    relatedBookings.data?.orders.filter(
      (order) => order.ticket && ['waiting', 'called', 'serving'].includes(order.ticket.status)
    ) ?? [];
  const displayedOrders: DisplayOrder[] =
    activeRelatedOrders.length > 0
      ? activeRelatedOrders.map((order) =>
          order.id === selectedEntry?.order?.id
            ? { ...order, ...selectedEntry.order, items: selectedEntry.order.items }
            : {
                ...order,
                items: order.items.map((item) => ({
                  ...item,
                  product_price: item.product_price ?? '0',
                  service_time_minutes: item.service_time_minutes ?? 0,
                })),
              }
        )
      : selectedEntry?.order
        ? [selectedEntry.order]
        : [];
  const groupedPaymentSummary = summarizeItems(displayedOrders.flatMap((order) => order.items));

  const invalidateQueue = () =>
    queryClient.invalidateQueries({ queryKey: ['staff-my-queue', orgId] });

  // Queue actions
  const serveMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/serve`, {}),
    onSuccess: invalidateQueue,
  });
  const completeMutation = useMutation({
    mutationFn: async ({
      entryId,
      orderId,
      ticketCode,
    }: {
      entryId: string;
      orderId?: string;
      ticketCode: string;
    }) => {
      await staffApi.complete(entryId);
      const order = orderId ? await get<Order>(`/api/v1/orders/${orderId}/receipt`) : null;
      return { order, ticketCode };
    },
    onSuccess: ({ order, ticketCode }) => {
      if (order) setLastCompletedReceipt({ order, ticketCode });
    },
  });
  const deferMutation = useMutation({
    mutationFn: (entryId: string) => staffApi.defer(entryId),
    onSuccess: invalidateQueue,
  });
  const cancelEntryMutation = useMutation({
    mutationFn: (entryId: string) => post(`/api/v1/staff/entries/${entryId}/cancel`, {}),
    onSuccess: invalidateQueue,
  });

  // Order actions
  const paymentMutation = useMutation({
    mutationFn: ({
      ids,
      paymentStatus,
      reason,
    }: {
      ids: string[];
      paymentStatus: string;
      reason?: string;
    }) =>
      Promise.all(
        ids.map((id) => patch(`/api/v1/orders/${id}/payment`, { paymentStatus, reason }))
      ),
    onSuccess: invalidateQueue,
  });
  const receiptMutation = useMutation({
    mutationFn: (id: string) => get<Order>(`/api/v1/orders/${id}/receipt`),
    onSuccess: (order) => printReceipt(order, selectedEntry?.ticket_code ?? ''),
  });

  const isLoading = queueLoading;
  const selected = selectedEntry;

  return (
    <div className="flex h-[calc(100dvh-8.25rem)] min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg)] lg:h-[calc(100dvh-4rem)] md:flex-row">
      {lastCompletedReceipt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completed-receipt-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-6 text-center shadow-2xl sm:p-7">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 id="completed-receipt-title" className="mt-4 text-xl font-bold text-gray-950">
              {t('dashboard.receiptReady')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {t('dashboard.order', {
                number: lastCompletedReceipt.order.order_number,
              })}
            </p>
            <button
              type="button"
              onClick={() =>
                printReceipt(lastCompletedReceipt.order, lastCompletedReceipt.ticketCode)
              }
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              {t('dashboard.printReceipt')}
            </button>
            <button
              type="button"
              onClick={() => {
                setLastCompletedReceipt(null);
                setSelectedEntryId(null);
                void invalidateQueue();
              }}
              className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              {t('dashboard.finishAndContinue')}
            </button>
          </div>
        </div>
      )}
      {/* Queue selector: horizontal on phones, left rail on larger screens */}
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white md:w-72 md:border-b-0 md:border-r xl:w-80">
        {/* Queue header */}
        <div className="border-b border-gray-100 px-3 py-2.5 md:px-4 md:py-3">
          {(queueData?.availableQueues?.length ?? 0) > 1 && (
            <select
              aria-label={t('dashboard.queueSelector')}
              value={selectedQueueId || queueData?.queueId || ''}
              onChange={(event) => {
                setSelectedQueueId(event.target.value);
                setSelectedEntryId(null);
              }}
              className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
            >
              {queueData?.availableQueues?.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center justify-between">
            <h2 className="flex items-center text-xs font-semibold text-gray-700 md:text-sm">
              <span className="hidden md:inline">
                {queueData?.queueName ?? t('dashboard.queueFallback')}
              </span>
              <span className="md:hidden">{t('dashboard.waitingShort')}</span>
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-white">
                {queueData?.totalActiveCount ?? queueData?.waitingCount ?? 0}
              </span>
            </h2>
            <p className="text-[11px] font-medium text-gray-400 md:hidden">
              {t('dashboard.selectTicket')}
            </p>
          </div>
        </div>
        <div className="flex min-h-0 overflow-x-auto overscroll-x-contain md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {isLoading && (
            <p className="w-full px-4 py-4 text-center text-sm text-gray-400 md:py-6">
              {t('states.loading', { ns: 'common' })}
            </p>
          )}
          {!isLoading && allEntries.length === 0 && (
            <p className="w-full px-4 py-4 text-center text-sm text-gray-400 md:py-6">
              {t('dashboard.noCustomers')}
            </p>
          )}
          {visibleEntries.map((entry) => {
            const ord = entry.order;
            return (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`w-28 shrink-0 border-r border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 md:w-full md:border-b md:border-r-0 md:px-4 md:py-3 ${
                  selected?.id === entry.id
                    ? 'border-b-2 border-b-brand-500 bg-brand-50 md:border-b-gray-100 md:border-l-4 md:border-l-brand-500 md:pl-3'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-800 md:text-base">
                    {entry.ticket_code}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] md:px-2 md:text-xs ${QUEUE_STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    <span className="hidden md:inline">
                      {QUEUE_STATUS_LABELS[entry.status]
                        ? t(QUEUE_STATUS_LABELS[entry.status], { ns: 'common' })
                        : entry.status}
                    </span>
                    <span className="md:hidden">{entry.status.slice(0, 1).toUpperCase()}</span>
                  </span>
                </div>
                {ord ? (
                  <div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 md:text-sm">
                      {ord.customer_name ?? t('dashboard.guest', { ns: 'staff' })}
                    </p>
                    <p className="mt-0.5 hidden text-sm font-medium text-gray-700 md:block">
                      {formatCurrency(ord.subtotal)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-0.5 hidden text-xs text-gray-400 md:block">
                    {t('dashboard.noOrder')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main: selected entry detail */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {t('dashboard.selectTicket')}
          </div>
        ) : (
          <div className="w-full space-y-5">
            {/* Ticket + queue status header */}
            <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                    {t('labels.ticketCode', { ns: 'common' })}
                  </p>
                  <p className="font-mono text-3xl font-bold text-gray-900 sm:text-4xl">
                    {selected.ticket_code}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-col sm:items-end sm:gap-1">
                  <span
                    className={`text-sm px-3 py-1 rounded-full font-medium ${QUEUE_STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    {QUEUE_STATUS_LABELS[selected.status]
                      ? t(QUEUE_STATUS_LABELS[selected.status], { ns: 'common' })
                      : selected.status}
                  </span>
                  {selected.order && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${selected.order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                    >
                      {selected.order.payment_status === 'paid'
                        ? t('states.paid', { ns: 'common' })
                        : t('states.unpaid', { ns: 'common' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                {/* Customer info */}
                {selected.order && (
                  <div className="grid gap-4 rounded-2xl border border-white/80 bg-white p-4 text-sm text-gray-600 shadow-[var(--shadow-soft)] sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {t('dashboard.customer')}
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {selected.order.customer_name ?? t('dashboard.guest', { ns: 'staff' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {t('labels.phone', { ns: 'common' })}
                      </p>
                      <p className="mt-1 break-words font-bold text-gray-900">
                        {selected.order.customer_phone ??
                          t('dashboard.contactUnavailable', { ns: 'staff' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {t('dashboard.lineName')}
                      </p>
                      <p className="mt-1 break-words font-bold text-gray-900">
                        {selected.order.customer_line_display_name ??
                          t('dashboard.contactUnavailable', { ns: 'staff' })}
                      </p>
                    </div>
                  </div>
                )}

                {selected.order?.booking_group_id && (
                  <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {t('dashboard.relatedBookingsLabel')}
                        </p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {relatedBookings.isLoading
                            ? t('states.loading', { ns: 'common' })
                            : t('dashboard.relatedBookings', {
                                count: activeRelatedOrders.length,
                              })}
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                        {t('dashboard.group')}
                      </span>
                    </div>
                    {relatedBookings.data && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeRelatedOrders.map((order) => (
                          <span
                            key={order.id}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700"
                          >
                            {order.order_number} ·{' '}
                            {ORDER_STATUS_LABELS[order.status]
                              ? t(ORDER_STATUS_LABELS[order.status], { ns: 'common' })
                              : order.status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {displayedOrders.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
                    {displayedOrders.map((order) => (
                      <section key={order.id} className="border-b border-gray-100 last:border-b-0">
                        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs font-medium uppercase text-gray-500">
                            {t('dashboard.order', { number: order.order_number })}
                          </span>
                          <span
                            className={`w-fit rounded-full px-2 py-0.5 text-xs ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {ORDER_STATUS_LABELS[order.status]
                              ? t(ORDER_STATUS_LABELS[order.status], { ns: 'common' })
                              : order.status}
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
                                      {t('states.paid', { ns: 'common' })}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  {t('units.minutes', {
                                    ns: 'common',
                                    count: item.service_time_minutes ?? 0,
                                  })}{' '}
                                  · {formatCurrency(item.product_price ?? 0)} x {item.quantity}
                                </p>
                              </div>
                              <div className="col-span-2 flex items-center justify-between border-t border-gray-100 pt-3 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right xl:col-span-2 xl:flex xl:border-t xl:pt-3">
                                <span className="text-xs font-semibold text-gray-400 xl:inline">
                                  {t('dashboard.subtotal')}
                                </span>
                                <span className="font-bold text-gray-950">
                                  {formatCurrency(item.subtotal)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                    <PaymentBreakdown summary={groupedPaymentSummary} t={t} />
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                    {t('dashboard.noLinkedOrder')}
                  </div>
                )}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
                {selected.order && (
                  <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t('dashboard.checkout')}
                    </p>
                    <p className="mt-2 text-3xl font-black text-gray-950">
                      {formatCurrency(groupedPaymentSummary.amountDue)}
                    </p>
                    <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
                      <div className="flex justify-between text-gray-500">
                        <span>{t('labels.total', { ns: 'common' })}</span>
                        <span>{formatCurrency(groupedPaymentSummary.total)}</span>
                      </div>
                      {groupedPaymentSummary.requiredPrepaid > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>{t('dashboard.prepaidAmount')}</span>
                          <span>{formatCurrency(groupedPaymentSummary.requiredPrepaid)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          groupedPaymentSummary.amountDue === 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {groupedPaymentSummary.amountDue === 0
                          ? t('states.paid', { ns: 'common' })
                          : t('states.unpaid', { ns: 'common' })}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          ORDER_STATUS_COLORS[selected.order.status] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {ORDER_STATUS_LABELS[selected.order.status]
                          ? t(ORDER_STATUS_LABELS[selected.order.status], { ns: 'common' })
                          : selected.order.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Queue action buttons */}
                <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('dashboard.ticketActions')}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {selected.status === 'called' && (
                      <>
                        <button
                          onClick={() => serveMutation.mutate(selected.id)}
                          disabled={serveMutation.isPending}
                          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {t('dashboard.startService')}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('dashboard.deferConfirm'))) {
                              deferMutation.mutate(selected.id);
                            }
                          }}
                          disabled={deferMutation.isPending}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {deferMutation.isPending
                            ? t('dashboard.deferring')
                            : t('dashboard.defer')}
                        </button>
                      </>
                    )}
                    {selected.status === 'serving' && (
                      <button
                        onClick={() =>
                          completeMutation.mutate({
                            entryId: selected.id,
                            orderId: selected.order?.id,
                            ticketCode: selected.ticket_code,
                          })
                        }
                        disabled={
                          completeMutation.isPending ||
                          (displayedOrders.length > 0 && groupedPaymentSummary.amountDue > 0)
                        }
                        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {t('dashboard.complete')}
                      </button>
                    )}
                    {['waiting', 'called'].includes(selected.status) && (
                      <button
                        onClick={() => {
                          if (confirm(t('dashboard.cancelTicketConfirm')))
                            cancelEntryMutation.mutate(selected.id);
                        }}
                        disabled={cancelEntryMutation.isPending}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        {t('dashboard.cancelTicket')}
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
                          {t('dashboard.orderActions')}
                        </p>
                        {['pending', 'processing'].includes(order.status) && (
                          <div className="mt-4 grid gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                paymentMutation.mutate({
                                  ids: displayedOrders
                                    .filter((displayed) => displayed.payment_status !== 'paid')
                                    .map((displayed) => displayed.id),
                                  paymentStatus: 'paid',
                                })
                              }
                              disabled={
                                paymentMutation.isPending || groupedPaymentSummary.amountDue === 0
                              }
                              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-500"
                            >
                              {groupedPaymentSummary.amountDue === 0
                                ? t('states.paid', { ns: 'common' })
                                : t('dashboard.markPaid', { ns: 'staff' })}
                            </button>
                          </div>
                        )}
                        {order.payment_status === 'paid' && order.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => receiptMutation.mutate(order.id)}
                            disabled={receiptMutation.isPending}
                            className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            {t('dashboard.printReceipt', { ns: 'staff' })}
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
