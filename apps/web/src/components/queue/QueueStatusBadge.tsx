import { QueueStatus } from '@line-queue/shared';

const STATUS_CONFIG: Record<QueueStatus, { label: string; className: string }> = {
  [QueueStatus.ACTIVE]: {
    label: 'Active',
    className: 'bg-green-100 text-green-800',
  },
  [QueueStatus.PAUSED]: {
    label: 'Paused',
    className: 'bg-yellow-100 text-yellow-800',
  },
  [QueueStatus.CLOSED]: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-600',
  },
};

interface QueueStatusBadgeProps {
  status: QueueStatus;
}

export function QueueStatusBadge({ status }: QueueStatusBadgeProps) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG[QueueStatus.CLOSED];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}
