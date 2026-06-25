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
  if (seconds <= 0) return 'Đến lượt';
  const m = Math.ceil(seconds / 60);
  return `${m} phút`;
}

function statusLabel(s: string) {
  switch (s) {
    case 'waiting':
      return 'Đang chờ';
    case 'called':
      return 'Đang gọi';
    case 'serving':
      return 'Đang phục vụ';
    case 'served':
      return 'Đã phục vụ';
    case 'cancelled':
      return 'Đã huỷ';
    case 'no_show':
      return 'Vắng mặt';
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
        setError('Không thể tải danh sách hàng đợi của bạn.');
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
          new Notification(`Sắp đến lượt: ${t.entry.ticket_code}`, {
            body: `Trạng thái: ${statusLabel(t.entry.status)} - Nhấn để xem chi tiết`,
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

  if (loading) return <div className="p-6 text-gray-500">Đang tải dashboard customer...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Customer</h1>
        <AccountMenu compact />
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

      {tickets.length === 0 ? (
        <div className="p-6 rounded-xl border border-gray-200 bg-white text-gray-500">
          Bạn chưa có hàng đợi nào đang hoạt động.
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
                    Trạng thái: <span className="font-medium">{statusLabel(t.entry.status)}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Còn {t.aheadCount} người phía trước · ETA{' '}
                    {formatDuration(t.estimatedWaitSeconds)}
                  </div>
                  {t.order && (
                    <div className="text-xs text-gray-400 mt-1">Đơn: {t.order.order_number}</div>
                  )}
                </div>
                {(t.entry.status === 'called' || t.aheadCount <= 1) && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    Sắp đến lượt
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
