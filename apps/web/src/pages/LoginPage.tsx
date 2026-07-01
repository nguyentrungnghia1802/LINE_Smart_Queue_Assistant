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
      setError('メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[var(--shadow-soft)] lg:grid-cols-[1fr_420px]">
        <section className="hidden bg-gray-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-sm font-bold">
              LQ
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight">LINE Smart Queue Assistant</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-gray-300">
              受付、商品選択、スタッフ呼び出し、LINE通知までを一つの画面で管理します。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">24h</p>
              <p className="mt-1 text-gray-300">オンライン受付</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">LINE</p>
              <p className="mt-1 text-gray-300">通知連携</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-2xl font-bold">JPY</p>
              <p className="mt-1 text-gray-300">決済デモ</p>
            </div>
          </div>
        </section>

        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white lg:hidden">
              LQ
            </div>
            <h2 className="mt-5 text-2xl font-bold text-gray-950">ログイン</h2>
            <p className="mt-1 text-sm text-gray-500">アカウントにログインしてください。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                メール
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gray-950 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'ログインしています…' : 'ログイン'}
            </button>

            <p className="pt-2 text-center text-sm text-gray-500">
              アカウントをお持ちでない場合{' '}
              <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
                顧客登録
              </Link>
            </p>
          </form>
        </div>
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
