import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { post } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await post<{ token: string; user: { id: string; role: 'customer'; displayName?: string; email?: string } }>(
        '/api/v1/auth/register',
        { displayName, email, password, phone: phone || undefined }
      );
      localStorage.setItem('auth_token', data.token);
      setUser({
        id: data.user.id,
        role: UserRole.CUSTOMER,
        displayName: data.user.displayName,
        email: data.user.email,
      });
      navigate('/customer', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng ký thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🟢</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Đăng ký Customer</h1>
          <p className="mt-1 text-sm text-gray-500">Tạo tài khoản để theo dõi hàng đợi của bạn</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-8 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại (tuỳ chọn)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Đang đăng ký…' : 'Đăng ký'}
          </button>

          <p className="text-sm text-gray-500 text-center pt-2">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Đăng nhập
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
