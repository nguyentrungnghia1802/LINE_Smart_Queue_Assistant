import { useAuthStore } from '../../store/authStore';

import { BranchManagerSettingsPage } from './BranchManagerSettingsPage';
import { ManagerSettingsPage } from './ManagerSettingsPage';

export function ManagerSettingsRoute() {
  const { user } = useAuthStore();
  return user?.isOrganizationOwner ? <ManagerSettingsPage /> : <BranchManagerSettingsPage />;
}
