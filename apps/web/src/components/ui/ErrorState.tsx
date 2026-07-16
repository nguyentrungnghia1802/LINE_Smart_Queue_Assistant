interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Generic error state for failed queries and boundary fallbacks.
 *
 * Usage:
 *   <ErrorState
 *     message="Failed to load queue status."
 *     onRetry={refetch}
 *   />
 */
export function ErrorState({ title, message, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <span className="text-4xl mb-3" aria-hidden="true">
        ⚠️
      </span>
      <h3 className="text-base font-semibold text-gray-900">{title ?? t('errors.UNKNOWN')}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-xs">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          {retryLabel ?? t('actions.retry')}
        </button>
      )}
    </div>
  );
}
import { useTranslation } from 'react-i18next';
