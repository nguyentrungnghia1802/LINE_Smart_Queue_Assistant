import { ClipboardList, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { QueueStatusBadge } from '../components/queue/QueueStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { useDeleteQueue, useQueue } from '../hooks/useQueues';
import { ApiClientError } from '../services/apiClient';

export function QueueDetailPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: queue, isLoading, isError } = useQueue(id ?? '');
  const deleteQueue = useDeleteQueue();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete() {
    if (!id) return;
    setDeleteError('');
    try {
      await deleteQueue.mutateAsync(id);
      navigate('/manager/queues', { replace: true });
    } catch (error) {
      setDeleteError(
        error instanceof ApiClientError && error.status === 409
          ? t('queue.deleteBlocked')
          : t('queue.deleteFailed')
      );
    }
  }

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
        <p className="text-gray-500 mb-4">{t('queue.notFound')}</p>
        <Link to="/manager/queues" className="text-brand-600 hover:underline text-sm">
          ← {t('queue.backToQueues')}
        </Link>
      </div>
    );
  }

  const activeCustomerCount = queue.waitingCount + queue.calledCount + queue.servingCount;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/manager/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← {t('nav.queue', { ns: 'common' })}
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
          to={`/manager/queues/${id}/manage`}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <ClipboardList className="h-4 w-4" />
          {t('queue.manage')}
        </Link>
        <Link
          to={`/manager/queues/${id}/settings`}
          className="inline-flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Settings className="h-4 w-4" />
          {t('nav.settings', { ns: 'common' })}
        </Link>
        <button
          type="button"
          onClick={() => {
            setDeleteError('');
            setConfirmDelete(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t('queue.delete')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <DetailCard label={t('queue.activeCustomers')} value={String(activeCustomerCount)} />
        <DetailCard label={t('queue.lastTicketNumber')} value={String(queue.currentNumber)} />
        {queue.maxCapacity && (
          <DetailCard label={t('queue.capacity')} value={String(queue.maxCapacity)} />
        )}
        {queue.avgServiceTimeMinutes && (
          <DetailCard
            label={t('queue.averageService')}
            value={String(queue.avgServiceTimeMinutes)}
          />
        )}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-queue-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <h2 id="delete-queue-title" className="text-lg font-bold text-gray-950">
              {t('queue.deleteTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {t('queue.deleteConfirm', { name: queue.name })}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{t('queue.deleteRequirement')}</p>
            {deleteError && (
              <p
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setConfirmDelete(false);
                }}
                disabled={deleteQueue.isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                {t('actions.cancel', { ns: 'common' })}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteQueue.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteQueue.isPending ? t('queue.deleting') : t('queue.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
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
