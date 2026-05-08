import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from './ErrorState';

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Receives the caught error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches uncaught errors anywhere in the subtree and shows an error UI
 * instead of an invisible blank screen.
 *
 * Wrap the entire app (in main.tsx or App.tsx) and optionally wrap
 * individual route segments for more granular recovery.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, forward to an observability service (e.g. Sentry)
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
          <ErrorState
            title="Something went wrong"
            message="An unexpected error occurred. You can try reloading the page."
            onRetry={this.reset}
            retryLabel="Try again"
          />
        </div>
      );
    }

    return this.props.children;
  }
}
