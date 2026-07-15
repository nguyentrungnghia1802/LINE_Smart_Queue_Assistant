import { useNavigate } from 'react-router-dom';

import { CalledBanner } from '../../components/ui/CalledBanner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProfileSkeleton, TicketCardSkeleton } from '../../components/ui/Skeleton';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets } from '../../hooks/useQueueEntry';

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

      <ActiveTicketsSection
        isLoading={isLoading}
        isError={isError}
        activeCount={activeCount}
        isAuthReady={canLoadLineTickets}
        authStatus={authStatus}
        onRetry={() => void refetch()}
        onViewAll={() => navigate('/liff/tickets')}
      />

      <HowItWorksSection />
    </div>
  );
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
  isAuthReady: boolean;
  authStatus: string;
  onRetry: () => void;
  onViewAll: () => void;
}

function ActiveTicketsSection({
  isLoading,
  isError,
  activeCount,
  isAuthReady,
  authStatus,
  onRetry,
  onViewAll,
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
          message="QRコードまたはリンクから順番待ちに参加してください。"
        />
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
