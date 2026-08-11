import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AuthSessionManager } from './components/auth/AuthSessionManager';
import { FormValidationManager } from './components/forms/FormValidationManager';
import { LocaleSync } from './components/i18n/LocaleSync';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { RouteLoadingState } from './components/ui/RouteLoadingState';
import { router } from './router';
import { queryClient } from './services/queryClient';

export default function App() {
  return (
    <ErrorBoundary>
      <LocaleSync />
      <FormValidationManager />
      <QueryClientProvider client={queryClient}>
        <AuthSessionManager>
          <Suspense fallback={<RouteLoadingState />}>
            <RouterProvider router={router} />
          </Suspense>
        </AuthSessionManager>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
