import { ManagerQRPage } from '../manager/ManagerQRPage';

export function StaffQRPage() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
      <ManagerQRPage endpoint="/api/v1/staff/branch" queryKey="staff-my-branch" />
    </div>
  );
}
