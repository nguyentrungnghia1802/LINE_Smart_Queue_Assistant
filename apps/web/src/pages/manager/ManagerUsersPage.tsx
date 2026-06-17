import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { get, patch, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  manager: 'Quản lý',
  admin: 'Admin',
};

export function ManagerUsersPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [addError, setAddError] = useState('');

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users-staff', orgId],
    queryFn: () => get<UserRow[]>(`/api/v1/users?orgId=${orgId}`),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: () => post('/api/v1/users/staff', form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users-staff', orgId] });
      setShowAdd(false);
      setForm({ displayName: '', email: '', password: '' });
      setAddError('');
    },
    onError: (err: { message?: string }) => setAddError(err?.message ?? 'Có lỗi xảy ra'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      patch(`/api/v1/users/staff/${userId}/status`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users-staff', orgId] }),
  });

  if (isLoading) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Nhân viên</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
        >
          + Thêm nhân viên
        </button>
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
                <th className="px-4 py-3 font-medium text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.display_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleStatusMutation.mutate({ userId: u.id, isActive: !u.is_active })}
                      disabled={toggleStatusMutation.isPending}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {u.is_active ? 'Đang làm' : 'Nghỉ'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add staff modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl space-y-4">
            <h2 className="font-semibold text-gray-900">Thêm nhân viên mới</h2>

            {[
              { label: 'Tên hiển thị *', key: 'displayName', type: 'text', placeholder: 'Nguyễn Văn X' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'nv@salon.com' },
              { label: 'Mật khẩu *', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}

            {addError && <p className="text-xs text-red-500">{addError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowAdd(false); setAddError(''); }}
                className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Huỷ
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.displayName || !form.email || !form.password}
                className="flex-1 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
