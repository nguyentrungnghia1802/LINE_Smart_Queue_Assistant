import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { patch } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

export function ManagerSettingsPage() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const mutation = useMutation({
    mutationFn: (dto: { displayName: string }) =>
      patch<{ displayName: string; email: string }>('/api/v1/users/me', dto),
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, displayName: data.displayName, email: data.email });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => setError('Có lỗi xảy ra. Vui lòng thử lại.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate({ displayName });
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Cài đặt tài khoản</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Thông tin cá nhân</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            value={email}
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-600">Đã lưu thành công!</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-6 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  );
}
