import { NavLink, Outlet } from 'react-router-dom';

import { useLiff } from '../../hooks/useLiff';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';

const NAV_ITEMS = [
  { to: '/liff/home', label: 'Home', icon: HomeIcon },
  { to: '/liff/tickets', label: 'My Tickets', icon: TicketsIcon },
  { to: '/liff/history', label: 'History', icon: HistoryIcon },
] as const;

/**
 * App shell for all LIFF customer-facing pages.
 *
 * Responsibilities:
 *   - Initialises the LIFF SDK once at mount (via useLiff)
 *   - Shows a full-screen loader while LIFF is initialising
 *   - Shows a full-screen error if LIFF init fails
 *   - Renders child routes (via <Outlet>) when ready
 *   - Provides a persistent bottom tab bar for primary navigation
 */
export function LiffLayout() {
  const { initStatus, error } = useLiff();

  if (initStatus === 'idle' || initStatus === 'loading') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-gray-500">Initialising…</p>
      </div>
    );
  }

  if (initStatus === 'error') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white px-6">
        <ErrorState
          title="Could not initialise"
          message={error?.message ?? 'LIFF initialisation failed. Please close and reopen.'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      {/* ── Top header ── */}
      <header className="bg-line-green text-white px-4 py-3 flex items-center gap-2 shrink-0">
        <span className="text-xl font-bold tracking-tight">
          {import.meta.env.VITE_APP_NAME ?? 'LINE Queue'}
        </span>
      </header>

      {/* ── Page content (scrollable) ── */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      {/* ── Bottom tab bar ── */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex items-stretch z-10 pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-line-green' : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// ── Inline SVG tab icons ──────────────────────────────────────────────────────

function HomeIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'fill-line-green' : 'fill-gray-400'}`}
      viewBox="0 0 24 24"
    >
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function TicketsIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'stroke-line-green' : 'stroke-gray-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  );
}

function HistoryIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${active ? 'stroke-line-green' : 'stroke-gray-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="12 8 12 12 14 14" />
      <path d="M3.05 11a9 9 0 1 0 .5-4.5" />
      <polyline points="3 3 3 9 9 9" />
    </svg>
  );
}
