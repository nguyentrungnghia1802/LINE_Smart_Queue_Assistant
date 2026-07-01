import type { TicketPositionResult } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';

interface TicketCardProps {
  ticket: TicketPositionResult;
  /** Called when the user taps the card to view full status */
  onClick?: () => void;
}

/**
 * Compact ticket summary card for the My Tickets list.
 *
 * Highlights called tickets with an amber ring.
 */
export function TicketCard({ ticket, onClick }: Readonly<TicketCardProps>) {
  const { entry, aheadCount, estimatedWaitSeconds } = ticket;
  const statusKey = entry.status as unknown as string;
  const waitMin = Math.ceil(estimatedWaitSeconds / 60);
  const isCalled = statusKey === 'called';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-(--radius-card) border shadow-sm hover:shadow-md transition-shadow p-5 ${
        isCalled ? 'border-amber-300 ring-2 ring-amber-200' : 'border-gray-200'
      }`}
      aria-label={`受付番号 ${entry.ticket_code}、ステータス: ${statusKey}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Ticket number */}
        <div>
          <p
            className={`text-3xl font-bold leading-none ${
              isCalled ? 'text-amber-500' : 'text-gray-900'
            }`}
          >
            {entry.ticket_code}
          </p>
          <p className="text-xs text-gray-400 mt-1">受付番号</p>
        </div>

        <StatusBadge status={statusKey} />
      </div>

      {/* ETA + position — only relevant while waiting */}
      {statusKey === 'waiting' && (
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <span>
            前に<span className="font-medium text-gray-900">{aheadCount}</span>名
          </span>
          <span>
            約<span className="font-medium text-gray-900">{waitMin}</span>分
          </span>
        </div>
      )}

      {/* Called prompt */}
      {isCalled && (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          詳細を確認してカウンターへお越しください
        </p>
      )}
    </button>
  );
}
