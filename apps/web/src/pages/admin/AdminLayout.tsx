import { Navigate, Outlet } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../../store/authStore';

export function AdminLayout() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-4xl mb-3">🚫</p>
          <p className="text-gray-700 font-medium">Bạn không có quyền truy cập trang Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
          <span className="font-bold text-brand-600">Admin Panel</span>
          <nav className="flex items-center gap-1 text-sm">
            <a href="/admin" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
              Dashboard
            </a>
            <a href="/admin/orgs" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
              Tổ chức
            </a>
            <a href="/admin/users" className="px-3 py-1.5 rounded hover:bg-gray-100 text-gray-700">
              Người dùng
            </a>
          </nav>
          <a href="/" className="ml-auto text-sm text-gray-400 hover:text-gray-700">
            ← Về Dashboard
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
