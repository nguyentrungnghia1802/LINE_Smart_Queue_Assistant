import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { get, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface QueueStatus {
  queue: { id: string; name: string; status: string; avg_service_seconds: number };
  waitingCount: number;
  estimatedWaitSeconds: number | null;
}

interface JoinResult {
  entry: { id: string; ticket_code: string };
  aheadCount: number;
  estimatedWaitSeconds: number | null;
}

export function PublicJoinPage() {
  const { t } = useTranslation(['customer', 'common']);
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery<QueueStatus>({
    queryKey: ['queue-status', queueId],
    queryFn: () => get<QueueStatus>(`/api/v1/queue/${queueId}/status`),
    refetchInterval: 30_000,
    enabled: !!queueId,
  });

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!queueId) return;
    setError('');
    setJoining(true);
    try {
      const result = await post<JoinResult>('/api/v1/queue/join', {
        queueId,
        guestName: guestName.trim() || undefined,
      });
      navigate(`/ticket/${result.entry.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('queueJoin.joinFailed', { ns: 'customer' });
      setError(msg);
    } finally {
      setJoining(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{t('states.loading', { ns: 'common' })}</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-2xl mb-2">😕</p>
          <p className="text-gray-700 font-medium">
            {t('publicJoin.unavailable', { ns: 'customer' })}
          </p>
        </div>
      </div>
    );
  }

  const { queue, waitingCount, estimatedWaitSeconds } = data;
  const isClosed = queue.status !== 'open';
  const waitMinutes = Math.ceil((estimatedWaitSeconds ?? 0) / 60);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => navigate('/customer')}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t('dashboard.title', { ns: 'customer' })}
          </button>
        )}

        {/* Header */}
        <div className="text-center">
          <span className="text-5xl">🟢</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{queue.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('publicJoin.onlineTicket', { ns: 'customer' })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-brand-600">{waitingCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t('states.waiting', { ns: 'common' })}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className="text-lg font-bold text-gray-800">
              {estimatedWaitSeconds
                ? t('units.approximateMinutes', { ns: 'common', count: waitMinutes })
                : t('queueJoin.unknown', { ns: 'customer' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('labels.estimatedWait', { ns: 'common' })}
            </p>
          </div>
        </div>

        {isClosed ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 font-medium">{t('publicJoin.closed', { ns: 'customer' })}</p>
          </div>
        ) : (
          <form
            onSubmit={handleJoin}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
          >
            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('labels.name', { ns: 'common' })}{' '}
                <span className="text-gray-400">{t('queueJoin.optional', { ns: 'customer' })}</span>
              </label>
              <input
                id="guestName"
                type="text"
                placeholder={t('booking.namePlaceholder', { ns: 'customer' })}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={100}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={joining}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-base transition-colors"
            >
              {joining
                ? t('publicJoin.gettingTicket', { ns: 'customer' })
                : `🎫 ${t('publicJoin.getTicket', { ns: 'customer' })}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
