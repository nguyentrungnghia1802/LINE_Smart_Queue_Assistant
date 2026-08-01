import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { QueueSummary } from '@line-queue/shared';

import { QueueStatusBadge } from './QueueStatusBadge';

interface QueueCardProps {
  queue: QueueSummary;
  sequence?: number;
}

export function QueueCard({ queue, sequence }: QueueCardProps) {
  const { t } = useTranslation(['manager', 'common']);
  const activeCustomerCount = queue.waitingCount + queue.calledCount + queue.servingCount;
  return (
    <Link
      to={`/manager/queues/${queue.id}`}
      className="block bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-200 transition-all p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="truncate font-semibold text-gray-900">
          {sequence ? `${sequence}. ` : ''}
          {queue.name}
        </h3>
        <QueueStatusBadge status={queue.status} />
      </div>

      {queue.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{queue.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
        <span>
          {t('queue.activeCustomers')}:{' '}
          <span className="font-medium text-gray-700">{activeCustomerCount}</span>
        </span>
        {queue.maxCapacity && (
          <span>
            {t('labels.capacity')}:{' '}
            <span className="font-medium text-gray-700">{queue.maxCapacity}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
