import { ManagerQRPage } from '../manager/ManagerQRPage';

export function StaffQRPage() {
  return <ManagerQRPage endpoint="/api/v1/staff/branch" queryKey="staff-my-branch" />;
}
