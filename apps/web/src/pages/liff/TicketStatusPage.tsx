import { useNavigate, useParams } from 'react-router-dom';

import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { TicketHeroSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets, useTicketStatus } from '../../hooks/useQueueEntry';

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
  const { authStatus } = useLiffRuntime();

  const {
    data: tickets,
    isLoading: isMyTicketsLoading,
    isError: isMyTicketsError,
    refetch: refetchMyTickets,
  } = useMyTickets({ enabled: authStatus === 'authenticated' });
  const {
    data: ticketStatus,
    isLoading: isTicketStatusLoading,
    isError: isTicketStatusError,
    refetch: refetchTicketStatus,
  } = useTicketStatus(entryId);

  const ticketData = tickets?.find((t) => t.entry.id === entryId) ?? ticketStatus;
  const isLoading = !ticketData && (isMyTicketsLoading || isTicketStatusLoading);
  const isError = !ticketData && isMyTicketsError && isTicketStatusError;

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
    return (
      <ErrorState
        message="受付状況を読み込めませんでした。"
        onRetry={() => {
          void refetchMyTickets();
          void refetchTicketStatus();
        }}
      />
    );
  }

  if (!ticketData) {
    return (
      <EmptyState
        icon="🎫"
        title="受付番号が見つかりません"
        message="この受付は完了またはキャンセル済みの可能性があります。"
        action={{ label: '受付番号へ戻る', onClick: () => navigate('/liff/tickets') }}
      />
    );
  }

  const { entry, aheadCount, estimatedWaitSeconds } = ticketData;
  const statusKey = entry.status as unknown as string;
  const waitMin = Math.ceil((estimatedWaitSeconds ?? 0) / 60);
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
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">受付番号</p>
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
            label="前の人数"
            value={aheadCount === 0 ? '次に呼ばれます' : String(aheadCount)}
            accent={aheadCount === 0}
          />
          <StatCard
            label="待ち時間目安"
            value={aheadCount === 0 ? 'まもなく' : `約${waitMin}分`}
            accent={aheadCount === 0}
          />
        </div>
      )}

      {/* ── Approx. currently serving ────────────────────────────────────── */}
      {approxServingNumber !== null && (
        <div className="bg-white rounded-(--radius-card) border border-gray-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              現在対応中（目安）
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
        ← すべての受付番号
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
