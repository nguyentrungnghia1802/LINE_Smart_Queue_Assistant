import { useQuery } from '@tanstack/react-query';

import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  manager: 'Quản lý',
  admin: 'Admin',
};

export function ManagerUsersPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users-staff', orgId],
    queryFn: () =>
      get<UserRow[]>(`/api/v1/users?orgId=${orgId}&role=staff`),
    enabled: !!orgId,
  });

  if (isLoading) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Nhân viên</h1>
      </div>

      {users.length === 0 ? (
        <p className="text-gray-400 text-sm">Chưa có nhân viên nào.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
