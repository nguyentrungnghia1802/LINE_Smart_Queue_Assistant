import type { TicketPositionResult } from '../../types';

interface TicketCardProps {
  ticket: TicketPositionResult;
  /** Called when the user taps the card to view full status */
  onClick?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  called: 'Called',
  serving: 'Being served',
  completed: 'Completed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
  no_show: 'No show',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: 'bg-blue-100 text-blue-800',
  called: 'bg-yellow-100 text-yellow-800',
  serving: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  skipped: 'bg-orange-100 text-orange-800',
  no_show: 'bg-red-100 text-red-700',
};

/**
 * Compact ticket summary card for the My Tickets list.
 */
export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const { entry, aheadCount, estimatedWaitSeconds } = ticket;
  const statusKey = entry.status as unknown as string;
  const waitMin = Math.ceil(estimatedWaitSeconds / 60);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Ticket number */}
        <div>
          <p className="text-3xl font-bold text-gray-900 leading-none">{entry.ticket_display}</p>
          <p className="text-xs text-gray-400 mt-1">Queue ticket</p>
        </div>

        {/* Status badge */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            STATUS_COLOR[statusKey] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABEL[statusKey] ?? statusKey}
        </span>
      </div>

      {/* ETA + position — only relevant while waiting or called */}
      {(entry.status as unknown as string) === 'waiting' && (
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-900">{aheadCount}</span> ahead
          </span>
          <span>
            ~<span className="font-medium text-gray-900">{waitMin}</span> min
          </span>
        </div>
      )}
    </button>
  );
}
