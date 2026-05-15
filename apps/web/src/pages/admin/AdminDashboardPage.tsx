import { useQuery } from '@tanstack/react-query';

import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

interface SystemStats {
  orgCount: number;
  userCount: number;
  queueCount: number;
  activeEntries: number;
}

export function AdminDashboardPage() {
  const { data } = useQuery<SystemStats>({
    queryKey: ['admin-stats'],
    queryFn: () => get<SystemStats>(`${API_BASE_PATH}/admin/stats`),
    retry: false,
  });

  const stats = [
    { label: 'Tổ chức', value: data?.orgCount ?? '—', icon: '🏢' },
    { label: 'Người dùng', value: data?.userCount ?? '—', icon: '👥' },
    { label: 'Hàng đợi', value: data?.queueCount ?? '—', icon: '📋' },
    { label: 'Đang chờ', value: data?.activeEntries ?? '—', icon: '⏳' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tổng quan hệ thống</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center"
          >
            <p className="text-3xl mb-1">{s.icon}</p>
            <p className="text-3xl font-black text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
