interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
  /** Optional call-to-action rendered below the message */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Generic empty-state placeholder for lists and detail pages.
 *
 * Usage:
 *   <EmptyState
 *     icon="🎫"
 *     title="No active tickets"
 *     message="Join a queue to receive your ticket."
 *     action={{ label: 'Find a queue', onClick: () => navigate('/liff') }}
 *   />
 */
export function EmptyState({ title, message, icon = '📭', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="text-5xl mb-4" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-gray-500 max-w-xs">{message}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
