import { Link } from 'react-router-dom';

import { QueueCard } from '../components/queue/QueueCard';
import { Spinner } from '../components/ui/Spinner';
import { useQueues } from '../hooks/useQueues';

export function QueuesPage() {
  const { data: queues, isLoading, isError } = useQueues();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Queues</h1>
        <Link
          to="/queues/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          + New Queue
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && <p className="text-red-600 text-sm">Failed to load queues. Please try again.</p>}

      {queues && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {queues.map((q) => (
            <QueueCard key={q.id} queue={q} />
          ))}
          {queues.length === 0 && (
            <p className="text-gray-500 col-span-3 py-12 text-center">
              No queues yet. Create your first queue to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
