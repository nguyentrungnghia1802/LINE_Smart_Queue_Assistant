import { useNavigate } from 'react-router-dom';

import { TicketCard } from '../../components/ticket/TicketCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { useMyTickets } from '../../hooks/useQueueEntry';

/**
 * Displays all active queue tickets for the current customer.
 *
 * URL: /liff/tickets
 *
 * Auto-refreshes every 30 s (configured in useMyTickets).
 * Tapping a ticket card navigates to the ticket detail page.
 */
export function MyTicketsPage() {
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
    return (
      <ErrorState
        message="Could not load your tickets. Please try again."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <EmptyState
        icon="🎫"
        title="No active tickets"
        message="You don't have any active queue tickets right now."
      />
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">My Tickets</h1>

      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.entry.id}
          ticket={ticket}
          onClick={() => navigate(`/liff/tickets/${ticket.entry.id}`)}
        />
      ))}
    </div>
  );
}
