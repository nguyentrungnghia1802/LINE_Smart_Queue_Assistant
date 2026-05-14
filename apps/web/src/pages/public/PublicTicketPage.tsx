import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { get } from '../../services/apiClient';

interface TicketStatus {
  entry: {
    id: string;
    ticket_display: string;
    status: string;
    created_at: string;
  };
  aheadCount: number;
  estimatedWaitSeconds: number | null;
  queueName: string;
}

function fmtWait(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Sắp tới lượt';
  const m = Math.ceil(seconds / 60);
  return m < 60 ? `~${m} phút` : `~${Math.floor(m / 60)} giờ ${m % 60} phút`;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  waiting: { label: 'Đang chờ', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  called: {
    label: 'Được gọi! Vui lòng đến quầy',
    color: 'bg-green-100 text-green-800',
    icon: '📢',
  },
  serving: { label: 'Đang được phục vụ', color: 'bg-blue-100 text-blue-800', icon: '✅' },
  completed: { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-800', icon: '✔️' },
  cancelled: { label: 'Đã huỷ', color: 'bg-red-100 text-red-800', icon: '❌' },
  no_show: { label: 'Vắng mặt', color: 'bg-orange-100 text-orange-800', icon: '🚫' },
};

export function PublicTicketPage() {
  const { entryId } = useParams<{ entryId: string }>();

  const { data, isLoading, isError } = useQuery<TicketStatus>({
    queryKey: ['ticket-status', entryId],
    queryFn: () => get<TicketStatus>(`/api/v1/queue/entry/${entryId}`),
    refetchInterval: 15_000,
    enabled: !!entryId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-2xl mb-2">😕</p>
          <p className="text-gray-700 font-medium">Không tìm thấy vé.</p>
        </div>
      </div>
    );
  }

  const { entry, aheadCount, estimatedWaitSeconds, queueName } = data;
  const statusInfo = STATUS_LABELS[entry.status] ?? {
    label: entry.status,
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
  };
  const isCalled = entry.status === 'called';
  const isActive = ['waiting', 'called'].includes(entry.status);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <span className="text-5xl">🟢</span>
          <h1 className="mt-3 text-xl font-bold text-gray-900">{queueName}</h1>
          <p className="text-sm text-gray-500 mt-1">Số vé của bạn</p>
        </div>

        {/* Ticket number */}
        <div
          className={`rounded-2xl p-8 text-center shadow-sm border ${isCalled ? 'bg-green-50 border-green-300 animate-pulse' : 'bg-white border-gray-200'}`}
        >
          <p className="text-7xl font-black text-brand-600">{entry.ticket_display}</p>
          <div
            className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}
          >
            <span>{statusInfo.icon}</span>
            {statusInfo.label}
          </div>
        </div>

        {/* Status info */}
        {isActive && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-800">{aheadCount}</p>
              <p className="text-xs text-gray-500 mt-1">Người trước bạn</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <p className="text-base font-bold text-gray-800">{fmtWait(estimatedWaitSeconds)}</p>
              <p className="text-xs text-gray-500 mt-1">Thời gian chờ</p>
            </div>
          </div>
        )}

        {isCalled && (
          <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
            <p className="text-green-800 font-bold text-lg">📢 Đến quầy ngay!</p>
            <p className="text-green-700 text-sm mt-1">
              Số của bạn đã được gọi. Vui lòng đến quầy phục vụ.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Tự động cập nhật mỗi 15 giây</p>
      </div>
    </div>
  );
}
