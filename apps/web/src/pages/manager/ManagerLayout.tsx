import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { AccountMenu } from '../../components/layout/AccountMenu';
import { useAuthStore } from '../../store/authStore';

export function ManagerLayout() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAllowed = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/manager" className="font-bold text-brand-600 mr-4">
            LINE Queue
          </Link>
          <nav className="flex items-center gap-1 flex-1">
            <NavLink to="/manager" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/manager/products" className={navClass}>
              Sản phẩm
            </NavLink>
            <NavLink to="/manager/users" className={navClass}>
              Nhân viên
            </NavLink>
            <NavLink to="/manager/qr" className={navClass}>
              Xuất QR
            </NavLink>
            <NavLink to="/manager/settings" className={navClass}>
              Cài đặt
            </NavLink>
          </nav>
          <AccountMenu />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
