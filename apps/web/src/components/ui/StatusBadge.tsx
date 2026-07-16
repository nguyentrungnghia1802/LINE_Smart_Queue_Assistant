import { useTranslation } from 'react-i18next';

const TICKET_STATUS_KEY: Record<string, string> = {
  waiting: 'states.waiting',
  called: 'states.called',
  serving: 'states.serving',
  completed: 'states.completed',
  cancelled: 'states.cancelled',
  skipped: 'states.skipped',
  no_show: 'states.noShow',
};

const STATUS_BG: Record<string, string> = {
  waiting: 'bg-blue-100 text-blue-800',
  called: 'bg-amber-100 text-amber-800',
  serving: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  skipped: 'bg-orange-100 text-orange-800',
  no_show: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

/**
 * Reusable ticket-status badge.
 *
 * Usage:
 *   <StatusBadge status="waiting" />
 *   <StatusBadge status="called" size="md" />
 */
export function StatusBadge({ status, size = 'sm' }: Readonly<StatusBadgeProps>) {
  const { t } = useTranslation('common');
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${
        STATUS_BG[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {TICKET_STATUS_KEY[status] ? t(TICKET_STATUS_KEY[status]) : status}
    </span>
  );
}
