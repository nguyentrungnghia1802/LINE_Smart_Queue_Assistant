import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useLiff } from '../../hooks/useLiff';
import { useJoinQueue, useQueueStatus } from '../../hooks/useQueueEntry';

/**
 * Allows a customer to join a specific queue.
 *
 * URL: /liff/join/:queueId
 *
 * Flow:
 *   1. Fetch live queue status (name, waiting count, ETA)
 *   2. User taps "Join Queue"
 *   3. Mutation fires POST /api/v1/queue/join
 *   4. On success, redirect to /liff/tickets/:entryId
 */
export function QueueJoinPage() {
  const { queueId = '' } = useParams<{ queueId: string }>();
  const { profile } = useLiff();
  const navigate = useNavigate();

  const { data: statusData, isLoading, isError, refetch } = useQueueStatus(queueId);
  const joinMutation = useJoinQueue();

  async function handleJoin() {
    const result = await joinMutation.mutateAsync({
      queueId,
      lineUserId: profile?.userId,
    });
    navigate(`/liff/tickets/${result.entry.id}`, { replace: true });
  }

  if (!queueId) {
    return (
      <EmptyState icon="❌" title="Invalid link" message="Queue ID is missing from the URL." />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !statusData) {
    return (
      <ErrorState
        message="Could not load queue information. Please try again."
        onRetry={() => void refetch()}
      />
    );
  }

  const { queue, waitingCount, estimatedWaitSeconds } = statusData;
  const waitMin = Math.ceil(estimatedWaitSeconds / 60);
  const isQueueOpen = queue.status === 'open';

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Queue info card */}
      <div className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{queue.name}</h1>
          {queue.description && <p className="text-sm text-gray-500 mt-1">{queue.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat label="Waiting" value={String(waitingCount)} />
          <Stat label="Est. wait" value={waitingCount === 0 ? '< 1 min' : `~${waitMin} min`} />
        </div>

        {/* Queue status indicator */}
        {!isQueueOpen && (
          <p className="text-sm text-red-600 font-medium">
            This queue is currently{' '}
            <span className="capitalize">{queue.status.replace('_', ' ')}</span> and not accepting
            new entries.
          </p>
        )}
      </div>

      {/* Join button */}
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={!isQueueOpen || joinMutation.isPending}
        className="w-full bg-line-green hover:opacity-90 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition-opacity"
      >
        {joinMutation.isPending ? 'Joining…' : 'Join Queue'}
      </button>

      {joinMutation.isError && (
        <p className="text-sm text-red-600 text-center">
          {joinMutation.error instanceof Error
            ? joinMutation.error.message
            : 'Could not join queue. Please try again.'}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
