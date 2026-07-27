import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { QueueCard } from '../components/queue/QueueCard';
import { Spinner } from '../components/ui/Spinner';
import { useQueues } from '../hooks/useQueues';

export function QueuesPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { data: queues, isLoading, isError } = useQueues();
  const [search, setSearch] = useState('');
  const visibleQueues = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (queues ?? []).filter(
      (queue) =>
        !query ||
        queue.name.toLocaleLowerCase().includes(query) ||
        queue.description?.toLocaleLowerCase().includes(query)
    );
  }, [queues, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.queue', { ns: 'common' })}</h1>
        <Link
          to="/manager/queues/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          + {t('queue.create')}
        </Link>
      </div>
      <label className="mb-5 flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('queue.search')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('queue.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && <p className="text-red-600 text-sm">{t('queue.listLoadFailed')}</p>}

      {queues && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleQueues.map((q, index) => (
            <QueueCard key={q.id} queue={q} sequence={index + 1} />
          ))}
          {visibleQueues.length === 0 && (
            <p className="text-gray-500 col-span-3 py-12 text-center">{t('queue.listEmpty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
