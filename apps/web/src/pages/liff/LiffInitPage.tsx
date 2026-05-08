import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '../../components/ui/Spinner';
import { useLiff } from '../../hooks/useLiff';

/**
 * LIFF landing page — resolves context and redirects immediately.
 *
 * Typical flows:
 *   • Direct link with no context → /liff/tickets (show my tickets)
 *   • liff.state carries a target URL → react-router resolves it after init
 *
 * This page is only briefly visible during the LIFF init redirect handshake.
 * LiffLayout already handles the loading state, so by the time this renders
 * initStatus is always 'ready'.
 */
export function LiffInitPage() {
  const { isLoggedIn } = useLiff();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to my tickets as the default LIFF entry point.
    // Future: read liff.state / query params to redirect to a specific queue.
    navigate('/liff/tickets', { replace: true });
  }, [navigate, isLoggedIn]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  );
}
