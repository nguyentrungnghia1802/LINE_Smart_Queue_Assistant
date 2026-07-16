import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProfileSkeleton, TicketCardSkeleton } from '../../components/ui/Skeleton';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets } from '../../hooks/useQueueEntry';
import type { TicketPositionResult } from '../../types';

// ── Step data — defined outside component to avoid re-creation ───────────────
const STEP_NUMBERS = [1, 2, 3, 4] as const;

/**
 * LIFF Home — first screen the user lands on.
 *
 * URL: /liff/home
 */
export function HomePage() {
  const { t } = useTranslation('customer');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [homeNotice, setHomeNotice] = useState('');
  const { profile, isLoggedIn, isInitialized, login, authStatus } = useLiffRuntime();
  const canLoadLineTickets = authStatus === 'authenticated';
  const {
    data: tickets,
    isLoading,
    isError,
    refetch,
  } = useMyTickets({
    enabled: canLoadLineTickets,
  });

  const calledTickets =
    tickets?.filter((t) => (t.entry.status as unknown as string) === 'called') ?? [];
  const activeCount = tickets?.length ?? 0;
  const primaryTicket = useMemo(() => tickets?.[0] ?? null, [tickets]);
  const defaultBookingPath = sanitizeLiffPath(import.meta.env.VITE_LIFF_DEFAULT_BOOKING_PATH);

  function startBooking() {
    if (defaultBookingPath) {
      navigate(defaultBookingPath);
      return;
    }
    setHomeNotice(t('home.scanPrompt'));
  }

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode || !canLoadLineTickets || isLoading) return;

    if (mode === 'booking') {
      setSearchParams({}, { replace: true });
      if (defaultBookingPath) {
        navigate(defaultBookingPath, { replace: true });
      } else {
        setHomeNotice(t('home.scanPrompt'));
      }
      return;
    }

    if (mode === 'ticket') {
      setSearchParams({}, { replace: true });
      if (!tickets || tickets.length === 0) {
        setHomeNotice(t('home.noTicket'));
      } else if (tickets.length === 1) {
        navigate(`/liff/tickets/${tickets[0].entry.id}`, { replace: true });
      } else {
        navigate('/liff/tickets', { replace: true });
      }
    }
  }, [
    canLoadLineTickets,
    defaultBookingPath,
    isLoading,
    navigate,
    searchParams,
    setSearchParams,
    t,
    tickets,
  ]);

  return (
    <div className="max-w-md mx-auto space-y-5">
      <ProfileSection
        profile={profile}
        isLoggedIn={isLoggedIn}
        isInitialized={isInitialized}
        isLoading={isLoading}
        onLogin={login}
      />

      {calledTickets.map((t) => (
        <CalledBanner
          key={t.entry.id}
          ticketDisplay={t.entry.ticket_code}
          onDismiss={() => navigate(`/liff/tickets/${t.entry.id}`)}
        />
      ))}

      {homeNotice && (
        <div className="rounded-(--radius-card) border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {homeNotice}
        </div>
      )}

      <QuickActions
        onStartBooking={startBooking}
        onViewTickets={() => navigate('/liff/tickets')}
        onViewHistory={() => navigate('/liff/history')}
      />

      <ActiveTicketsSection
        isLoading={isLoading}
        isError={isError}
        activeCount={activeCount}
        primaryTicket={primaryTicket}
        isAuthReady={canLoadLineTickets}
        authStatus={authStatus}
        onRetry={() => void refetch()}
        onViewAll={() => navigate('/liff/tickets')}
        onOpenTicket={(entryId) => navigate(`/liff/tickets/${entryId}`)}
      />

      <HowItWorksSection />
    </div>
  );
}

function sanitizeLiffPath(value: string | undefined): string {
  if (!value) return '';
  if (!value.startsWith('/liff/')) return '';
  return value;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ProfileSectionProps {
  profile: { displayName: string; pictureUrl?: string } | null | undefined;
  isLoggedIn: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  onLogin: () => void;
}

function ProfileSection({
  profile,
  isLoggedIn,
  isInitialized,
  isLoading,
  onLogin,
}: Readonly<ProfileSectionProps>) {
  const { t } = useTranslation(['customer', 'common']);
  if (isLoading && !isInitialized) {
    return <ProfileSkeleton />;
  }

  if (isLoggedIn && profile) {
    const initial = profile.displayName.charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-3">
        {profile.pictureUrl ? (
          <img
            src={profile.pictureUrl}
            alt={profile.displayName}
            className="h-12 w-12 rounded-full object-cover border-2 border-line-green"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-line-green flex items-center justify-center text-white font-bold text-lg">
            {initial}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 leading-tight">{profile.displayName}</p>
          <p className="text-xs text-gray-500">{t('home.lineAccount', { ns: 'customer' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-line-green/10 rounded-(--radius-card) p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800">
          {t('home.lineLogin', { ns: 'customer' })}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{t('home.loginHint', { ns: 'customer' })}</p>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="bg-line-green text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      >
        {t('actions.login', { ns: 'common' })}
      </button>
    </div>
  );
}

interface ActiveTicketsSectionProps {
  isLoading: boolean;
  isError: boolean;
  activeCount: number;
  primaryTicket: TicketPositionResult | null;
  isAuthReady: boolean;
  authStatus: string;
  onRetry: () => void;
  onViewAll: () => void;
  onOpenTicket: (entryId: string) => void;
}

function ActiveTicketsSection({
  isLoading,
  isError,
  activeCount,
  primaryTicket,
  isAuthReady,
  authStatus,
  onRetry,
  onViewAll,
  onOpenTicket,
}: Readonly<ActiveTicketsSectionProps>) {
  const { t } = useTranslation(['customer', 'common']);
  function renderContent() {
    if (!isAuthReady) {
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
    if (isLoading) {
      return <TicketCardSkeleton />;
    }
    if (isError) {
      return <ErrorState message={t('home.loadFailed', { ns: 'customer' })} onRetry={onRetry} />;
    }
    if (activeCount === 0) {
      return (
        <EmptyState
          icon="🎫"
          title={t('home.noTicket', { ns: 'customer' })}
          message={t('home.noTicketDescription', { ns: 'customer' })}
        />
      );
    }
    if (primaryTicket) {
      return (
        <button
          type="button"
          onClick={() => onOpenTicket(primaryTicket.entry.id)}
          className="w-full bg-white rounded-(--radius-card) border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 font-semibold">
                {t('home.currentTicket', { ns: 'customer' })}
              </p>
              <p className="mt-1 text-4xl font-extrabold text-gray-900 leading-none">
                {primaryTicket.entry.ticket_code}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t('labels.peopleAhead', { ns: 'common' })}:{' '}
                {primaryTicket.aheadCount === 0
                  ? t('units.none', { ns: 'common' })
                  : t('units.people', { ns: 'common', count: primaryTicket.aheadCount })}
              </p>
            </div>
            <span className="text-line-green text-2xl" aria-hidden="true">
              ›
            </span>
          </div>
        </button>
      );
    }
    const label = t('home.activeTicket', { ns: 'customer' });
    return (
      <button
        type="button"
        onClick={onViewAll}
        className="w-full bg-white rounded-(--radius-card) border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-extrabold text-gray-900 leading-none">{activeCount}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
          <span className="text-gray-400 text-2xl" aria-hidden="true">
            ›
          </span>
        </div>
      </button>
    );
  }

  return (
    <section aria-label={t('home.activeTicket', { ns: 'customer' })}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
        {t('home.activeTicket', { ns: 'customer' })}
      </h2>
      {renderContent()}
    </section>
  );
}

function QuickActions({
  onStartBooking,
  onViewTickets,
  onViewHistory,
}: Readonly<{
  onStartBooking: () => void;
  onViewTickets: () => void;
  onViewHistory: () => void;
}>) {
  const { t } = useTranslation('customer');
  return (
    <section aria-label={t('home.quickActions')} className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onStartBooking}
        className="rounded-(--radius-card) bg-line-green px-4 py-4 text-left text-white shadow-sm transition hover:opacity-90"
      >
        <span className="block text-sm font-bold">{t('home.startBooking')}</span>
        <span className="mt-1 block text-xs text-white/80">{t('home.newBooking')}</span>
      </button>
      <button
        type="button"
        onClick={onViewTickets}
        className="rounded-(--radius-card) border border-gray-200 bg-white px-4 py-4 text-left text-gray-900 shadow-sm transition hover:bg-gray-50"
      >
        <span className="block text-sm font-bold">{t('home.currentTicket')}</span>
        <span className="mt-1 block text-xs text-gray-500">{t('home.checkTicket')}</span>
      </button>
      <button
        type="button"
        onClick={onViewHistory}
        className="col-span-2 rounded-(--radius-card) border border-gray-200 bg-white px-4 py-3 text-left text-gray-900 shadow-sm transition hover:bg-gray-50"
      >
        <span className="block text-sm font-bold">{t('home.bookingHistory')}</span>
        <span className="mt-1 block text-xs text-gray-500">{t('home.checkHistory')}</span>
      </button>
    </section>
  );
}

function HowItWorksSection() {
  const { t } = useTranslation('customer');
  return (
    <section aria-label={t('home.guide')}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
        {t('home.guide')}
      </h2>
      <div className="bg-white rounded-(--radius-card) border border-gray-200 p-4 space-y-3">
        {STEP_NUMBERS.map((step, i) => (
          <div key={step} className="flex items-start gap-3">
            <span
              className="shrink-0 h-7 w-7 rounded-full bg-line-green/15 text-line-green font-bold text-sm flex items-center justify-center"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">{t(`home.step${step}Title`)}</p>
              <p className="text-xs text-gray-500">{t(`home.step${step}Description`)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
