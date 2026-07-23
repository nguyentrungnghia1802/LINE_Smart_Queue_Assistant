import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { AccountMenu } from '../../components/layout/AccountMenu';
import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

type Ticket = {
  entry: {
    id: string;
    queue_id: string;
    ticket_code: string;
    status: string;
    estimated_wait_seconds: number | null;
    called_at: string | null;
  };
  order: {
    id: string;
    order_number: string;
    customer_name: string | null;
    subtotal: string | number;
  } | null;
  aheadCount: number;
  estimatedWaitSeconds: number;
};

export function CustomerDashboardPage() {
  const { t } = useTranslation(['customer', 'common']);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const prevUrgentIdsRef = useRef<Set<string>>(new Set());

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const urgentTickets = useMemo(
    () => tickets.filter((ticket) => ticket.entry.status === 'called' || ticket.aheadCount <= 1),
    [tickets]
  );

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') {
      navigate('/login', { replace: true });
      return;
    }

    let mounted = true;
    let pollingPaused = false;
    const fetchTickets = async () => {
      if (pollingPaused) return;
      try {
        const data = await get<Ticket[]>('/api/v1/queue/me');
        if (!mounted) return;
        setTickets(data);
        setError('');
      } catch {
        if (!mounted) return;
        pollingPaused = true;
        setError(t('errors.NETWORK_ERROR', { ns: 'common' }));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchTickets();
    const timer = setInterval(() => {
      void fetchTickets();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isAuthenticated, user?.role, navigate, t]);

  useEffect(() => {
    const currentUrgent = new Set(urgentTickets.map((ticket) => ticket.entry.id));
    const previousUrgent = prevUrgentIdsRef.current;

    for (const ticket of urgentTickets) {
      if (!previousUrgent.has(ticket.entry.id)) {
        try {
          const audio = new Audio('/notification.mp3');
          void audio.play().catch(() => undefined);
        } catch {
          // no-op
        }
        if (window.Notification && Notification.permission === 'granted') {
          const statusKey = ticket.entry.status === 'no_show' ? 'noShow' : ticket.entry.status;
          new Notification(
            t('dashboard.notificationTitle', {
              ns: 'customer',
              ticket: ticket.entry.ticket_code,
            }),
            {
              body: t('dashboard.notificationBody', {
                ns: 'customer',
                status: t(`states.${statusKey}`, {
                  ns: 'common',
                  defaultValue: ticket.entry.status,
                }),
              }),
            }
          );
        }
      }
    }

    prevUrgentIdsRef.current = currentUrgent;
  }, [urgentTickets, t]);

  useEffect(() => {
    if (window.Notification && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title', { ns: 'customer' })}
          </h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <AccountMenu compact />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-500">
          {t('dashboard.loading', { ns: 'customer' })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.title', { ns: 'customer' })}
        </h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <AccountMenu compact />
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

      {tickets.length === 0 ? (
        <div className="p-6 rounded-xl border border-gray-200 bg-white text-gray-500">
          {t('dashboard.noActiveTicket', { ns: 'customer' })}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <button
              key={ticket.entry.id}
              type="button"
              onClick={() => navigate(`/ticket/${ticket.entry.id}`)}
              className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {ticket.entry.ticket_code}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('dashboard.status', { ns: 'customer' })}:{' '}
                    <span className="font-medium">
                      {t(
                        `states.${
                          ticket.entry.status === 'no_show' ? 'noShow' : ticket.entry.status
                        }`,
                        {
                          ns: 'common',
                          defaultValue: ticket.entry.status,
                        }
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('dashboard.aheadEta', {
                      ns: 'customer',
                      count: ticket.aheadCount,
                      eta:
                        ticket.estimatedWaitSeconds <= 0
                          ? t('dashboard.turnNow', { ns: 'customer' })
                          : t('units.minutes', {
                              ns: 'common',
                              count: Math.ceil(ticket.estimatedWaitSeconds / 60),
                            }),
                    })}
                  </div>
                  {ticket.order && (
                    <div className="text-xs text-gray-400 mt-1">
                      {t('dashboard.order', {
                        ns: 'customer',
                        number: ticket.order.order_number,
                      })}
                    </div>
                  )}
                </div>
                {(ticket.entry.status === 'called' || ticket.aheadCount <= 1) && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {t('dashboard.approaching', { ns: 'customer' })}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
