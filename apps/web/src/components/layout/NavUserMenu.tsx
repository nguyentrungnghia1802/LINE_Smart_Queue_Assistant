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

  function handleOpenAccount() {
    setOpen(false);
    navigate('/account');
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const displayName = user?.displayName ?? user?.email ?? 'アカウント';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={undefined} className="hidden">
        戻る
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
            className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="mt-0.5 text-xs text-gray-500 truncate">
                {user?.email ?? 'メール未設定'}
              </p>
              <p className="mt-1 text-xs text-gray-400">{user?.role ?? 'ゲスト'}</p>
            </div>
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={handleOpenAccount}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              情報を見る
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
