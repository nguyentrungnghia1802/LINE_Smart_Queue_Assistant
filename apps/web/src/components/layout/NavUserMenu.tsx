import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

interface NavUserMenuProps {
  compact?: boolean;
}

export function NavUserMenu({ compact = false }: Readonly<NavUserMenuProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
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

  const displayName = user?.displayName ?? user?.email ?? t('nav.account');
  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'A';
  const roleLabel = user?.role ?? 'guest';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={undefined} className="hidden">
        {t('actions.back')}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
            {initial}
          </span>
          {!compact && (
            <span className="hidden max-w-36 truncate text-sm font-semibold text-gray-800 sm:inline">
              {displayName}
            </span>
          )}
          <span
            aria-hidden="true"
            className={`h-2 w-2 rotate-45 border-b-2 border-r-2 border-gray-400 transition-transform ${
              open ? 'translate-y-0.5 rotate-[225deg]' : '-translate-y-0.5'
            }`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-3 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-gray-900/10"
          >
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-950 text-sm font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950">{displayName}</p>
                <p className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {roleLabel}
                </p>
              </div>
            </div>
            <div className="my-2 border-t border-gray-100" />
            <button
              type="button"
              onClick={handleOpenAccount}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t('nav.account')}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {t('actions.logout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
