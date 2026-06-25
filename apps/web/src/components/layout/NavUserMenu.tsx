import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

interface NavUserMenuProps {
  compact?: boolean;
}

export function NavUserMenu({ compact = false }: Readonly<NavUserMenuProps>) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const displayName = user?.displayName ?? user?.email ?? 'Tài khoản';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={undefined} className="hidden">
        Quay về
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {!compact && <span className="hidden sm:inline max-w-40 truncate">{displayName}</span>}
          <span aria-hidden="true">▾</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="mt-0.5 text-xs text-gray-500 truncate">
                {user?.email ?? 'Chưa có email'}
              </p>
              <p className="mt-1 text-xs text-gray-400">Role: {user?.role ?? 'guest'}</p>
            </div>
            {showInfo && (
              <div className="mx-3 mb-2 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                <dl className="space-y-2">
                  <InfoRow label="User ID" value={user?.id} />
                  <InfoRow label="Name" value={user?.displayName} />
                  <InfoRow label="Email" value={user?.email} />
                  <InfoRow label="Role" value={user?.role} />
                  <InfoRow label="Organization" value={user?.organizationId} />
                </dl>
              </div>
            )}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={() => setShowInfo((value) => !value)}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Xem thông tin
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: Readonly<{ label: string; value?: string | null }>) {
  return (
    <div>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-all text-gray-800">{value || '-'}</dd>
    </div>
  );
}
