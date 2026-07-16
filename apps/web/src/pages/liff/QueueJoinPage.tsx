import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { QueueInfoSkeleton } from '../../components/ui/Skeleton';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useJoinQueue, useQueueStatus } from '../../hooks/useQueueEntry';

/**
 * Join-queue screen.
 *
 * URL: /liff/join/:queueId
 *
 * Flow:
 *   1. Fetch live queue status (name, count, ETA)
 *   2. Optional: user enters notes
 *   3. Tap "Join Queue" → POST /api/v1/queue/join
 *      LINE identity is attached by the backend from the verified JWT only.
 *   4a. New ticket → navigate to /liff/tickets/:entryId
 *   4b. isExisting ticket → same navigation (idempotent)
 */
export function QueueJoinPage() {
  const { t } = useTranslation(['customer', 'common']);
  const { queueId = '' } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { authStatus } = useLiffRuntime();
  const [notes, setNotes] = useState('');

  const { data: statusData, isLoading, isError, refetch } = useQueueStatus(queueId);
  const joinMutation = useJoinQueue();

  async function handleJoin() {
    if (authStatus !== 'authenticated') return;
    const result = await joinMutation.mutateAsync({
      queueId,
      notes: notes.trim() || undefined,
    });
    navigate(`/liff/tickets/${result.entry.id}`, { replace: true });
  }

  // ── Guard: missing queueId ─────────────────────────────────────────────
  if (!queueId) {
    return (
      <EmptyState
        icon="❌"
        title={t('queueJoin.invalidTitle', { ns: 'customer' })}
        message={t('queueJoin.invalidMessage', { ns: 'customer' })}
      />
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <QueueInfoSkeleton />
        <div className="h-14 bg-gray-200 rounded-xl animate-pulse" aria-hidden="true" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (isError || !statusData) {
    return (
      <ErrorState
        message={t('queueJoin.loadFailed', { ns: 'customer' })}
        onRetry={() => void refetch()}
      />
    );
  }

  const { queue, waitingCount, estimatedWaitSeconds } = statusData;
  const waitMin = Math.ceil(estimatedWaitSeconds / 60);
  const isQueueOpen = queue.status === 'open';

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* ── Queue info card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-(--radius-card) border border-gray-200 shadow-sm p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{queue.name}</h1>
            {queue.description && <p className="text-sm text-gray-500 mt-1">{queue.description}</p>}
          </div>
          {/* Queue status pill */}
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
              isQueueOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
            }`}
          >
            {queue.status.replace('_', ' ')}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <StatCell
            label={t('queueJoin.waitingPeople', { ns: 'customer' })}
            value={String(waitingCount)}
          />
          <StatCell
            label={t('labels.estimatedWait', { ns: 'common' })}
            value={
              waitingCount === 0
                ? t('queueJoin.lessThanMinute', { ns: 'customer' })
                : t('units.approximateMinutes', { ns: 'common', count: waitMin })
            }
          />
          <StatCell
            label={t('queueJoin.averageService', { ns: 'customer' })}
            value={t('units.seconds', { ns: 'common', count: queue.avg_service_seconds })}
          />
        </div>

        {/* Capacity warning */}
        {queue.max_capacity !== null && waitingCount >= queue.max_capacity && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            {t('queueJoin.full', { ns: 'customer' })}
          </p>
        )}
      </div>

      {/* ── Notes input ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="join-notes" className="block text-sm font-medium text-gray-700 mb-1">
          {t('queueJoin.memo', { ns: 'customer' })}{' '}
          <span className="text-gray-400 font-normal">
            {t('queueJoin.optional', { ns: 'customer' })}
          </span>
        </label>
        <textarea
          id="join-notes"
          rows={2}
          maxLength={200}
          placeholder={t('queueJoin.memoPlaceholder', { ns: 'customer' })}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-green resize-none"
        />
      </div>

      {/* ── Join button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={!isQueueOpen || joinMutation.isPending || authStatus !== 'authenticated'}
        className="w-full bg-line-green hover:opacity-90 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-all"
        aria-busy={joinMutation.isPending}
      >
        {joinMutation.isPending
          ? t('queueJoin.joining', { ns: 'customer' })
          : t('queueJoin.join', { ns: 'customer' })}
      </button>

      {authStatus !== 'authenticated' && (
        <p role="status" className="text-sm text-gray-500 text-center">
          {t('queueJoin.authRequired', { ns: 'customer' })}
        </p>
      )}

      {/* ── Error feedback ────────────────────────────────────────────────── */}
      {joinMutation.isError && (
        <p role="alert" className="text-sm text-red-600 text-center">
          {joinMutation.error instanceof Error
            ? joinMutation.error.message
            : t('queueJoin.joinFailed', { ns: 'customer' })}
        </p>
      )}

      {/* ── Closed notice ─────────────────────────────────────────────────── */}
      {!isQueueOpen && (
        <p className="text-sm text-gray-500 text-center">
          {t('queueJoin.stopped', { ns: 'customer' })}
        </p>
      )}
    </div>
  );
}

function StatCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="py-1 px-2">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
