import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(roleHomePath(user.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // get updated user from store after login
      const updatedUser = useAuthStore.getState().user;
      navigate(updatedUser ? roleHomePath(updatedUser.role) : '/app', { replace: true });
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🟢</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">LINE Queue</h1>
          <p className="mt-1 text-sm text-gray-500">Đăng nhập vào tài khoản của bạn</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[var(--radius-card)] border border-gray-200 shadow-sm p-8 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <p className="text-sm text-gray-500 text-center pt-2">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Đăng ký customer
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function roleHomePath(role: UserRole): string {
  if (role === UserRole.ADMIN) return '/admin';
  if (role === UserRole.MANAGER) return '/manager';
  if (role === UserRole.STAFF) return '/staff';
  if (role === UserRole.CUSTOMER) return '/customer';
  return '/app';
}
