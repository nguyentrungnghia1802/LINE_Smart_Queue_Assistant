import { Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../store/authStore';

export function RoleRedirectPage() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (
    user.role === UserRole.MANAGER ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.SUPER_ADMIN
  ) {
    return <Navigate to="/manager" replace />;
  }

  if (user.role === UserRole.STAFF) {
    return <Navigate to="/staff" replace />;
  }

  if (user.role === UserRole.CUSTOMER) {
    return <Navigate to="/customer" replace />;
  }

  return <Navigate to="/login" replace />;
}
