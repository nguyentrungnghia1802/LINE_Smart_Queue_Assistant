import { Outlet } from 'react-router-dom';

import { useLiff } from '../../hooks/useLiff';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';

/**
 * App shell for all LIFF customer-facing pages.
 *
 * Responsibilities:
 *   - Initialises the LIFF SDK once at mount
 *   - Shows a full-screen loader while LIFF is initialising
 *   - Shows a full-screen error if LIFF init fails
 *   - Renders child routes (via <Outlet>) when ready
 *   - Mobile-first layout: no persistent nav, safe-area aware
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
      {/* ── Minimal LIFF header ── */}
      <header className="bg-line-green text-white px-4 py-3 flex items-center gap-2 safe-top">
        <span className="text-xl font-bold tracking-tight">
          {import.meta.env.VITE_APP_NAME ?? 'LINE Queue'}
        </span>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
