import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { QueueInfoSkeleton } from '../../components/ui/Skeleton';
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
  const { queueId = '' } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');

  const { data: statusData, isLoading, isError, refetch } = useQueueStatus(queueId);
  const joinMutation = useJoinQueue();

  async function handleJoin() {
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
        title="リンクが無効です"
        message="URLにキューIDがありません。元のリンクから開いてください。"
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
        message="キュー情報を読み込めませんでした。もう一度お試しください。"
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
          <StatCell label="待ち人数" value={String(waitingCount)} />
          <StatCell
            label="待ち時間目安"
            value={waitingCount === 0 ? '1分未満' : `約${waitMin}分`}
          />
          <StatCell label="平均対応" value={`${queue.avg_service_seconds}秒`} />
        </div>

        {/* Capacity warning */}
        {queue.max_capacity !== null && waitingCount >= queue.max_capacity && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            このキューは定員に達しています。
          </p>
        )}
      </div>

      {/* ── Notes input ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="join-notes" className="block text-sm font-medium text-gray-700 mb-1">
          メモ <span className="text-gray-400 font-normal">（任意）</span>
        </label>
        <textarea
          id="join-notes"
          rows={2}
          maxLength={200}
          placeholder="例: 予約名、配慮事項など"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-line-green resize-none"
        />
      </div>

      {/* ── Join button ──────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={!isQueueOpen || joinMutation.isPending}
        className="w-full bg-line-green hover:opacity-90 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-all"
        aria-busy={joinMutation.isPending}
      >
        {joinMutation.isPending ? '参加しています…' : '順番待ちに参加'}
      </button>

      {/* ── Error feedback ────────────────────────────────────────────────── */}
      {joinMutation.isError && (
        <p role="alert" className="text-sm text-red-600 text-center">
          {joinMutation.error instanceof Error
            ? joinMutation.error.message
            : '順番待ちに参加できませんでした。もう一度お試しください。'}
        </p>
      )}

      {/* ── Closed notice ─────────────────────────────────────────────────── */}
      {!isQueueOpen && (
        <p className="text-sm text-gray-500 text-center">
          現在、このキューは新規受付を停止しています。
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
