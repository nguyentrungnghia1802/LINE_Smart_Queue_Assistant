import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../../store/authStore';

export function StaffLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAllowed =
    user.role === UserRole.STAFF ||
    user.role === UserRole.MANAGER ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.SUPER_ADMIN;

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link to="/staff" className="font-bold text-brand-600 mr-4">
            LINE Queue
          </Link>
          <nav className="flex items-center gap-1 flex-1">
            <NavLink to="/staff" end className={navClass}>
              Đơn hàng
            </NavLink>
            <NavLink to="/staff/products" className={navClass}>
              Sản phẩm
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
