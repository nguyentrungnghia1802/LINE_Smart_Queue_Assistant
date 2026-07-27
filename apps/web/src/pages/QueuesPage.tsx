import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { QueueCard } from '../components/queue/QueueCard';
import { Spinner } from '../components/ui/Spinner';
import { useQueues } from '../hooks/useQueues';
import { ApiClientError } from '../services/apiClient';

export function QueuesPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { data: queues, error, isError, isFetching, isLoading, refetch } = useQueues();
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

      {isError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">{t('queue.listLoadFailed')}</p>
          {error instanceof ApiClientError && error.message && (
            <p className="mt-1 text-xs text-red-700">{error.message}</p>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {t('actions.retry', { ns: 'common' })}
          </button>
        </div>
      )}

      {!isError && queues && (
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
