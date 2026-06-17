import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../store/authStore';

const DEMO_ACCOUNTS = [
  { label: 'Quản lý', email: 'alice@queue-lab.test', role: 'manager' },
  { label: 'Nhân viên', email: 'bob@queue-lab.test', role: 'staff' },
];
const DEMO_PASSWORD = 'Demo@1234';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // get updated user from store after login
      const updatedUser = useAuthStore.getState().user;
      if (
        updatedUser?.role === UserRole.MANAGER ||
        updatedUser?.role === UserRole.ADMIN ||
        updatedUser?.role === UserRole.SUPER_ADMIN
      ) {
        navigate('/manager');
      } else if (updatedUser?.role === UserRole.STAFF) {
        navigate('/staff');
      } else if (updatedUser?.role === UserRole.CUSTOMER) {
        navigate('/qr/demo_the_queue_lab_token_001');
      } else {
        navigate('/');
      }
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
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
        </form>

        {/* Demo accounts */}
        <div className="mt-6">
          <p className="text-center text-xs text-gray-400 mb-3">Tài khoản demo (nhấn để điền)</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className="border border-gray-200 bg-white hover:bg-gray-50 rounded-lg py-2 px-3 text-center text-xs font-medium text-gray-700 transition-colors shadow-sm"
              >
                <span className="block text-lg mb-0.5">
                  {acc.role === 'manager' ? '👔' : acc.role === 'staff' ? '🧑‍💼' : '🛒'}
                </span>
                {acc.label}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-gray-300 mt-2">Mật khẩu: {DEMO_PASSWORD}</p>
        </div>
      </div>
    </div>
  );
}
