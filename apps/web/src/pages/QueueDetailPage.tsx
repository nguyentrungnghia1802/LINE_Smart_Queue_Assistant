import { Link, useParams } from 'react-router-dom';

import { QueueStatusBadge } from '../components/queue/QueueStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { useQueue } from '../hooks/useQueues';

export function QueueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: queue, isLoading, isError } = useQueue(id ?? '');

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !queue) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Queue not found.</p>
        <Link to="/queues" className="text-brand-600 hover:underline text-sm">
          ← Back to queues
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Queues
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{queue.name}</h1>
        <QueueStatusBadge status={queue.status} />
      </div>

      {queue.description && <p className="text-gray-500 mb-6">{queue.description}</p>}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          to={`/staff/queues/${id}`}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          📋 Quản lý hàng đợi
        </Link>
        <Link
          to={`/queues/${id}/display`}
          className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          📺 Hiển thị QR
        </Link>
        <Link
          to={`/queues/${id}/settings`}
          className="inline-flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          ⚙️ Cài đặt
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <DetailCard label="Current Number" value={String(queue.currentNumber)} />
        {queue.maxCapacity && <DetailCard label="Max Capacity" value={String(queue.maxCapacity)} />}
        {queue.avgServiceTimeMinutes && (
          <DetailCard label="Avg. Service (min)" value={String(queue.avgServiceTimeMinutes)} />
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
