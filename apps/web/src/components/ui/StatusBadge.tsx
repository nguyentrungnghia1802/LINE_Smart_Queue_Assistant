const TICKET_STATUS_LABEL: Record<string, string> = {
  waiting: '待機中',
  called: '呼び出し中',
  serving: '対応中',
  completed: '完了',
  cancelled: 'キャンセル済み',
  skipped: 'スキップ済み',
  no_show: '不在',
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
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${
        STATUS_BG[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {TICKET_STATUS_LABEL[status] ?? status}
    </span>
  );
}
