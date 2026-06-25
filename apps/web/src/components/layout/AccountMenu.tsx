import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

interface AccountMenuProps {
  compact?: boolean;
}

export function AccountMenu({ compact = false }: Readonly<AccountMenuProps>) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const displayName = user?.displayName ?? user?.email ?? 'Account';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {!compact && <span className="hidden max-w-40 truncate sm:inline">{displayName}</span>}
        <span aria-hidden="true">v</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{user?.email ?? 'No email'}</p>
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
            {showInfo ? 'Hide information' : 'View information'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
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
