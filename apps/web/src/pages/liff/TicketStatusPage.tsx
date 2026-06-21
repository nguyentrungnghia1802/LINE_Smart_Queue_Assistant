import { useNavigate, useParams } from 'react-router-dom';

import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { TicketHeroSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useMyTickets } from '../../hooks/useQueueEntry';

/**
 * Live status page for a single ticket.
 *
 * URL: /liff/tickets/:entryId
 *
 * - Derives ticket data from the myTickets query (polls every 30 s)
 * - Shows a CalledBanner with pulsing dot when status is "called"
 * - Displays position, approx. currently-serving number, and ETA
 */
export function TicketStatusPage() {
  const { entryId = '' } = useParams<{ entryId: string }>();
  const navigate = useNavigate();

  const { data: tickets, isLoading, isError, refetch } = useMyTickets();

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <TicketHeroSkeleton />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-(--radius-card) border border-gray-200 p-4 animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded w-12 mx-auto" aria-hidden="true" />
            <div className="h-3 bg-gray-200 rounded w-16 mx-auto" aria-hidden="true" />
          </div>
          <div className="bg-white rounded-(--radius-card) border border-gray-200 p-4 animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded w-16 mx-auto" aria-hidden="true" />
            <div className="h-3 bg-gray-200 rounded w-12 mx-auto" aria-hidden="true" />
          </div>
        </div>
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
  const isCalled = statusKey === 'called';
  const isWaiting = statusKey === 'waiting';

  // Approximate currently-serving ticket number (ticket_number - aheadCount - 1).
  // This is a UI estimation; the backend doesn't expose a "now serving" field yet.
  const approxServingNumber =
    isWaiting && aheadCount >= 0 ? Math.max(entry.ticket_number - aheadCount - 1, 1) : null;

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Called banner */}
      {isCalled && <CalledBanner ticketDisplay={entry.ticket_code} />}

      {/* ── Hero ticket card ──────────────────────────────────────────────── */}
      <div
        className={`bg-white rounded-(--radius-card) border shadow-sm p-8 text-center space-y-3 ${
          isCalled ? 'border-amber-300 ring-2 ring-amber-200' : 'border-gray-200'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your ticket</p>
        <p
          className={`text-7xl font-extrabold leading-none ${
            isCalled ? 'text-amber-500' : 'text-gray-900'
          }`}
        >
          {entry.ticket_code}
        </p>
        <StatusBadge status={statusKey} size="md" />
        {/* notes field removed from queue_entries in schema v2 */}
      </div>

      {/* ── ETA + position stats — only while waiting or called ───────────── */}
      {(isWaiting || isCalled) && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Ahead of you"
            value={aheadCount === 0 ? "You're next!" : String(aheadCount)}
            accent={aheadCount === 0}
          />
          <StatCard
            label="Est. wait"
            value={aheadCount === 0 ? 'Any moment' : `~${waitMin} min`}
            accent={aheadCount === 0}
          />
        </div>
      )}

      {/* ── Approx. currently serving ────────────────────────────────────── */}
      {approxServingNumber !== null && (
        <div className="bg-white rounded-(--radius-card) border border-gray-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Now serving (approx.)
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {entry.queue_id ? entry.ticket_code.replace(/\d+$/, '') : ''}
              {String(approxServingNumber).padStart(
                entry.ticket_code.replace(/\D/g, '').length,
                '0'
              )}
            </p>
          </div>
          <span className="text-gray-300 text-3xl" aria-hidden="true">
            〉
          </span>
        </div>
      )}

      {/* ── Back link ────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/liff/tickets')}
        className="w-full text-sm text-gray-400 hover:text-gray-600 text-center py-3 transition-colors"
      >
        ← All my tickets
      </button>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent }: Readonly<StatCardProps>) {
  return (
    <div
      className={`rounded-(--radius-card) border shadow-sm p-4 text-center ${
        accent ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
      }`}
    >
      <p className={`text-2xl font-bold ${accent ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
