import { Navigate } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../store/authStore';

export function RoleRedirectPage() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === UserRole.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === UserRole.MANAGER) {
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
