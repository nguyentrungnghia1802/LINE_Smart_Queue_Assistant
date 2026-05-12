interface CalledBannerProps {
  ticketDisplay: string;
  onDismiss?: () => void;
}

/**
 * Full-width attention banner rendered when the user's ticket has been called.
 * Placed at the top of the page content area (inside LiffLayout's <main>).
 *
 * Accessibility: role="alert" ensures screen-readers announce it immediately.
 */
export function CalledBanner({ ticketDisplay, onDismiss }: Readonly<CalledBannerProps>) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 rounded-(--radius-card) bg-amber-400 text-amber-950 p-4 flex items-start gap-3"
    >
      {/* Pulsing dot */}
      <span className="mt-0.5 shrink-0 relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-700 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-800" />
      </span>

      <div className="flex-1">
        <p className="font-bold text-sm leading-snug">Ticket {ticketDisplay} — please proceed!</p>
        <p className="text-xs mt-0.5 opacity-80">
          Your number has been called. Please head to the counter now.
        </p>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md border border-amber-900/20 px-3 py-1.5 text-sm font-medium text-amber-900 hover:text-amber-950 hover:bg-amber-300/40"
        >
          View ticket
        </button>
      )}
    </div>
  );
}
