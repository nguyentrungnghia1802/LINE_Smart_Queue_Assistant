import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

function formatDuration(seconds: number) {
  if (seconds <= 0) return '順番です';
  const m = Math.ceil(seconds / 60);
  return `${m} 分`;
}

function statusLabel(s: string) {
  switch (s) {
    case 'waiting':
      return '待機中';
    case 'called':
      return '呼び出し中';
    case 'serving':
      return '対応中';
    case 'served':
      return '対応済み';
    case 'cancelled':
      return 'キャンセル済み';
    case 'no_show':
      return '不在';
    default:
      return s;
  }
}

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const prevUrgentIdsRef = useRef<Set<string>>(new Set());

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const urgentTickets = useMemo(
    () => tickets.filter((t) => t.entry.status === 'called' || t.aheadCount <= 1),
    [tickets]
  );

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') {
      navigate('/login', { replace: true });
      return;
    }

    let mounted = true;
    const fetchTickets = async () => {
      try {
        const data = await get<Ticket[]>('/api/v1/queue/me');
        if (!mounted) return;
        setTickets(data);
        setError('');
      } catch {
        if (!mounted) return;
        setError('キュー一覧を読み込めませんでした。');
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
  }, [isAuthenticated, user?.role, navigate]);

  useEffect(() => {
    const currentUrgent = new Set(urgentTickets.map((t) => t.entry.id));
    const previousUrgent = prevUrgentIdsRef.current;

    for (const t of urgentTickets) {
      if (!previousUrgent.has(t.entry.id)) {
        try {
          const audio = new Audio('/notification.mp3');
          void audio.play().catch(() => undefined);
        } catch {
          // no-op
        }
        if (window.Notification && Notification.permission === 'granted') {
          new Notification(`まもなく順番です: ${t.entry.ticket_code}`, {
            body: `ステータス: ${statusLabel(t.entry.status)} - タップして詳細を確認`,
          });
        }
      }
    }

    prevUrgentIdsRef.current = currentUrgent;
  }, [urgentTickets]);

  useEffect(() => {
    if (window.Notification && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  if (loading) return <div className="p-6 text-gray-500">顧客ダッシュボードを読み込み中...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">顧客ダッシュボード</h1>
        <AccountMenu compact />
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

      {tickets.length === 0 ? (
        <div className="p-6 rounded-xl border border-gray-200 bg-white text-gray-500">
          現在有効な受付はありません。
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button
              key={t.entry.id}
              type="button"
              onClick={() => navigate(`/ticket/${t.entry.id}`)}
              className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{t.entry.ticket_code}</div>
                  <div className="text-sm text-gray-500">
                    ステータス: <span className="font-medium">{statusLabel(t.entry.status)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    前に{t.aheadCount}人 · ETA {formatDuration(t.estimatedWaitSeconds)}
                  </div>
                  {t.order && (
                    <div className="text-xs text-gray-400 mt-1">注文: {t.order.order_number}</div>
                  )}
                </div>
                {(t.entry.status === 'called' || t.aheadCount <= 1) && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    まもなく順番です
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
