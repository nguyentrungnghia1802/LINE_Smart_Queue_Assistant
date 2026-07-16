import { useTranslation } from 'react-i18next';

import { QueueStatus } from '@line-queue/shared';

const STATUS_CONFIG: Record<QueueStatus, { labelKey: string; className: string }> = {
  [QueueStatus.ACTIVE]: {
    labelKey: 'states.active',
    className: 'bg-green-100 text-green-800',
  },
  [QueueStatus.PAUSED]: {
    labelKey: 'states.paused',
    className: 'bg-yellow-100 text-yellow-800',
  },
  [QueueStatus.CLOSED]: {
    labelKey: 'states.closed',
    className: 'bg-gray-100 text-gray-600',
  },
};

interface QueueStatusBadgeProps {
  status: QueueStatus;
}

export function QueueStatusBadge({ status }: QueueStatusBadgeProps) {
  const { t } = useTranslation('common');
  const { labelKey, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG[QueueStatus.CLOSED];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
    >
      {t(labelKey)}
    </span>
  );
}
