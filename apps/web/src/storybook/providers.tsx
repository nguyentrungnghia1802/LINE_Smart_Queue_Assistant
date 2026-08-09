/* eslint-disable react-refresh/only-export-components -- Storybook providers also expose deterministic fixtures. */
import { type ReactNode, useEffect } from 'react';

import { UserRole } from '@line-queue/shared';

import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../store/authTypes';

/**
 * Provides a deterministic authenticated user for stories that render the
 * shared business shell. It never performs a login request or persists data.
 */
export function StoryAuthProvider({
  user,
  children,
}: Readonly<{ user: AuthUser; children: ReactNode }>) {
  useEffect(() => {
    const previousUser = useAuthStore.getState().user;
    useAuthStore.setState({ user, isAuthenticated: true });

    return () => {
      useAuthStore.setState({ user: previousUser, isAuthenticated: Boolean(previousUser) });
    };
  }, [user]);

  return children;
}

export const managerStoryUser: AuthUser = {
  id: 'storybook-manager',
  displayName: 'Demo Manager',
  email: 'manager@example.test',
  role: UserRole.MANAGER,
  organizationId: 'org-demo',
  preferredLocale: 'ja',
  organizationLocale: 'ja',
  isOrganizationOwner: false,
  branchIds: ['branch-tokyo'],
};
