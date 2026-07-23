import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { BrandLogo } from '../../components/BrandLogo';
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

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link
            to="/customer"
            className="flex min-w-0 items-center gap-2.5 font-bold text-gray-950"
          >
            <BrandLogo decorative className="h-9 w-9" />
            <span className="hidden truncate text-base sm:inline">
              {t('brandName', { ns: 'common' })}
            </span>
          </Link>

          <nav
            aria-label={t('accessibility.mainNavigation', { ns: 'common' })}
            className="ml-auto flex items-center"
          >
            <NavLink
              to="/customer"
              end
              className={({ isActive }) =>
                `rounded-full px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {t('nav.tickets', { ns: 'common' })}
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            {t('nav.tickets', { ns: 'common' })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950 sm:text-3xl">
            {t('dashboard.title', { ns: 'customer' })}
          </h1>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-500">
            {t('dashboard.loading', { ns: 'customer' })}
          </div>
        ) : (
          <>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {tickets.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-500">
                {t('dashboard.noActiveTicket', { ns: 'customer' })}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.entry.id}
                    type="button"
                    onClick={() => navigate(`/ticket/${ticket.entry.id}`)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
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
                          <div className="mt-1 text-xs text-gray-400">
                            {t('dashboard.order', {
                              ns: 'customer',
                              number: ticket.order.order_number,
                            })}
                          </div>
                        )}
                      </div>
                      {(ticket.entry.status === 'called' || ticket.aheadCount <= 1) && (
                        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                          {t('dashboard.approaching', { ns: 'customer' })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
