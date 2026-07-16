import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { TicketCard } from '../../components/ticket/TicketCard';
import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { TicketCardSkeleton } from '../../components/ui/Skeleton';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets } from '../../hooks/useQueueEntry';

/**
 * Displays all active queue tickets for the current customer.
 *
 * URL: /liff/tickets
 *
 * - Auto-refreshes every 30 s (configured in useMyTickets)
 * - Shows a CalledBanner at the top for any "called" tickets
 * - Renders a skeleton while loading
 */
export function MyTicketsPage() {
  const { t } = useTranslation(['customer', 'common']);
  const navigate = useNavigate();
  const { authStatus } = useLiffRuntime();
  const canLoadLineTickets = authStatus === 'authenticated';
  const {
    data: tickets,
    isLoading,
    isError,
    refetch,
  } = useMyTickets({
    enabled: canLoadLineTickets,
  });

  if (!canLoadLineTickets) {
    return (
      <EmptyState
        icon="🎫"
        title={
          authStatus === 'error'
            ? t('home.authRequired', { ns: 'customer' })
            : t('home.authenticating', { ns: 'customer' })
        }
        message={t('home.authHint', { ns: 'customer' })}
      />
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <TicketCardSkeleton />
        <TicketCardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={t('home.loadFailed', { ns: 'customer' })}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <EmptyState
        icon="🎫"
        title={t('home.noTicket', { ns: 'customer' })}
        message={t('home.scanPrompt', { ns: 'customer' })}
      />
    );
  }

  const calledTickets = tickets.filter((t) => (t.entry.status as unknown as string) === 'called');

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Urgent banners for called tickets */}
      {calledTickets.map((t) => (
        <CalledBanner
          key={t.entry.id}
          ticketDisplay={t.entry.ticket_code}
          onDismiss={() => navigate(`/liff/tickets/${t.entry.id}`)}
        />
      ))}

      <h1 className="text-lg font-semibold text-gray-900">
        {t('common:nav.tickets')}{' '}
        <span className="text-sm font-normal text-gray-400">({tickets.length})</span>
      </h1>

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
