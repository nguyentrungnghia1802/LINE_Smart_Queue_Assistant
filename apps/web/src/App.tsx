import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { AuthSessionManager } from './components/auth/AuthSessionManager';
import { FormValidationManager } from './components/forms/FormValidationManager';
import { LocaleSync } from './components/i18n/LocaleSync';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { router } from './router';
import { queryClient } from './services/queryClient';

export default function App() {
  return (
    <ErrorBoundary>
      <LocaleSync />
      <FormValidationManager />
      <QueryClientProvider client={queryClient}>
        <AuthSessionManager>
          <RouterProvider router={router} />
        </AuthSessionManager>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
