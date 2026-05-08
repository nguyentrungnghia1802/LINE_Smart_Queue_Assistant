import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useMyTickets } from '../../hooks/useQueueEntry';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  called: '📣 Called — please proceed',
  serving: '✅ Being served',
  completed: 'Completed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
  no_show: 'No show',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: 'text-blue-600',
  called: 'text-yellow-600',
  serving: 'text-green-600',
  completed: 'text-gray-500',
  cancelled: 'text-red-500',
  skipped: 'text-orange-500',
  no_show: 'text-red-500',
};

/**
 * Live status page for a single ticket.
 *
 * URL: /liff/tickets/:entryId
 *
 * Derives ticket data from the myTickets query (already polling every 30 s).
 * If the entry is not in the list (completed/cancelled), shows a fallback state.
 */
export function TicketStatusPage() {
  const { entryId = '' } = useParams<{ entryId: string }>();
  const navigate = useNavigate();

  const { data: tickets, isLoading, isError, refetch } = useMyTickets();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Could not load ticket status." onRetry={() => void refetch()} />;
  }

  const ticketData = tickets?.find((t) => t.entry.id === entryId);

  if (!ticketData) {
    return (
      <EmptyState
        icon="🎫"
        title="Ticket not found"
        message="This ticket may have been completed or cancelled."
        action={{ label: 'Back to my tickets', onClick: () => navigate('/liff/tickets') }}
      />
    );
  }

  const { entry, aheadCount, estimatedWaitSeconds } = ticketData;
  const statusKey = entry.status as unknown as string;
  const waitMin = Math.ceil(estimatedWaitSeconds / 60);

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Big ticket number */}
      <div className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Your ticket
        </p>
        <p className="text-7xl font-extrabold text-gray-900">{entry.ticket_display}</p>
        <p className={`mt-3 text-sm font-semibold ${STATUS_COLOR[statusKey] ?? 'text-gray-600'}`}>
          {STATUS_LABEL[statusKey] ?? statusKey}
        </p>
      </div>

      {/* ETA card — only while waiting */}
      {statusKey === 'waiting' && (
        <div className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-6 grid grid-cols-2 gap-4 text-center">
          <EtaStat label="Ahead of you" value={String(aheadCount)} />
          <EtaStat
            label="Est. wait"
            value={aheadCount === 0 ? 'Your turn soon' : `~${waitMin} min`}
          />
        </div>
      )}

      {/* Notes */}
      {entry.notes && <p className="text-sm text-gray-500 text-center">Note: {entry.notes}</p>}

      <button
        type="button"
        onClick={() => navigate('/liff/tickets')}
        className="w-full text-sm text-gray-500 hover:text-gray-700 text-center py-2 transition-colors"
      >
        ← All my tickets
      </button>
    </div>
  );
}

function EtaStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
