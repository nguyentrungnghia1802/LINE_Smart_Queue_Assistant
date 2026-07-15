import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProfileSkeleton, TicketCardSkeleton } from '../../components/ui/Skeleton';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets } from '../../hooks/useQueueEntry';
import type { TicketPositionResult } from '../../types';

// ── Step data — defined outside component to avoid re-creation ───────────────
const STEPS = [
  {
    title: 'QRコードまたはリンクを開く',
    desc: '店頭QR、LINEメッセージ、直接URLから開始できます。',
  },
  { title: '順番待ちに参加する', desc: '受付番号はすぐに発行されます。' },
  { title: '待ち時間を確認する', desc: '自分の順番と目安時間をリアルタイムで確認できます。' },
  { title: '呼び出し後に戻る', desc: '順番になるとLINEメッセージで通知されます。' },
];

/**
 * LIFF Home — first screen the user lands on.
 *
 * URL: /liff/home
 */
export function HomePage() {
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
    setHomeNotice('予約を開始するには、店舗のQRコードを読み取ってください。');
  }

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode || !canLoadLineTickets || isLoading) return;

    if (mode === 'booking') {
      setSearchParams({}, { replace: true });
      if (defaultBookingPath) {
        navigate(defaultBookingPath, { replace: true });
      } else {
        setHomeNotice('予約を開始するには、店舗のQRコードを読み取ってください。');
      }
      return;
    }

    if (mode === 'ticket') {
      setSearchParams({}, { replace: true });
      if (!tickets || tickets.length === 0) {
        setHomeNotice('現在有効な受付番号はありません。');
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

      <QuickActions onStartBooking={startBooking} onViewTickets={() => navigate('/liff/tickets')} />

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
          <p className="text-xs text-gray-500">LINEアカウント</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-line-green/10 rounded-(--radius-card) p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800">LINEでログイン</p>
        <p className="text-xs text-gray-500 mt-0.5">受付番号を確認できます</p>
      </div>
      <button
        type="button"
        onClick={onLogin}
        className="bg-line-green text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      >
        ログイン
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
  function renderContent() {
    if (!isAuthReady) {
      return (
        <EmptyState
          icon="🎫"
          title={authStatus === 'error' ? 'LINE認証が必要です' : 'LINE認証中です'}
          message="受付番号をLINEアカウントに紐づけるため、認証完了後に表示します。"
        />
      );
    }
    if (isLoading) {
      return <TicketCardSkeleton />;
    }
    if (isError) {
      return <ErrorState message="受付番号を読み込めませんでした。" onRetry={onRetry} />;
    }
    if (activeCount === 0) {
      return (
        <EmptyState
          icon="🎫"
          title="有効な受付番号はありません"
          message="予約する場合は「予約する」から店舗の受付ページへ進んでください。"
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
              <p className="text-xs text-gray-400 font-semibold">現在の受付番号</p>
              <p className="mt-1 text-4xl font-extrabold text-gray-900 leading-none">
                {primaryTicket.entry.ticket_code}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                前の人数:{' '}
                {primaryTicket.aheadCount === 0 ? 'なし' : `${primaryTicket.aheadCount}名`}
              </p>
            </div>
            <span className="text-line-green text-2xl" aria-hidden="true">
              ›
            </span>
          </div>
        </button>
      );
    }
    const label = '有効な受付番号';
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
    <section aria-label="有効な受付番号">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
        有効な受付
      </h2>
      {renderContent()}
    </section>
  );
}

function QuickActions({
  onStartBooking,
  onViewTickets,
}: Readonly<{ onStartBooking: () => void; onViewTickets: () => void }>) {
  return (
    <section aria-label="クイックアクション" className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onStartBooking}
        className="rounded-(--radius-card) bg-line-green px-4 py-4 text-left text-white shadow-sm transition hover:opacity-90"
      >
        <span className="block text-sm font-bold">予約する</span>
        <span className="mt-1 block text-xs text-white/80">新しい受付を開始</span>
      </button>
      <button
        type="button"
        onClick={onViewTickets}
        className="rounded-(--radius-card) border border-gray-200 bg-white px-4 py-4 text-left text-gray-900 shadow-sm transition hover:bg-gray-50"
      >
        <span className="block text-sm font-bold">現在の受付</span>
        <span className="mt-1 block text-xs text-gray-500">受付番号を確認</span>
      </button>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section aria-label="使い方">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">使い方</h2>
      <div className="bg-white rounded-(--radius-card) border border-gray-200 p-4 space-y-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex items-start gap-3">
            <span
              className="shrink-0 h-7 w-7 rounded-full bg-line-green/15 text-line-green font-bold text-sm flex items-center justify-center"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">{step.title}</p>
              <p className="text-xs text-gray-500">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
