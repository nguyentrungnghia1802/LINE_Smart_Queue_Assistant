import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { AccountMenu } from '../../components/layout/AccountMenu';
import { useAuthStore } from '../../store/authStore';

export function AdminLayout() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="rounded-2xl border border-white/80 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-gray-700 font-medium">管理者ページにアクセスする権限がありません。</p>
        </div>
      </div>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" className="flex items-center gap-3 font-bold text-gray-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-950 text-sm text-white">
              LQ
            </span>
            <span>管理者パネル</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/admin" end className={navClass}>
              ダッシュボード
            </NavLink>
            <NavLink to="/admin/orgs" className={navClass}>
              組織
            </NavLink>
          </nav>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
