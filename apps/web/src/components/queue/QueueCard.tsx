import { Link } from 'react-router-dom';

import type { Queue } from '@line-queue/shared';
import { formatTicketNumber } from '@line-queue/shared';

import { QueueStatusBadge } from './QueueStatusBadge';

interface QueueCardProps {
  queue: Queue;
}

export function QueueCard({ queue }: QueueCardProps) {
  return (
    <Link
      to={`/queues/${queue.id}`}
      className="block bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-200 transition-all p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 truncate">{queue.name}</h3>
        <QueueStatusBadge status={queue.status} />
      </div>

      {queue.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{queue.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
        <span>
          Current:{' '}
          <span className="font-medium text-gray-700">
            {formatTicketNumber(queue.currentNumber)}
          </span>
        </span>
        {queue.maxCapacity && (
          <span>
            Cap: <span className="font-medium text-gray-700">{queue.maxCapacity}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
