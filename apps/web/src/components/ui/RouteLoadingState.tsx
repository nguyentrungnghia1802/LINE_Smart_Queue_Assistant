import { useTranslation } from 'react-i18next';

import { Spinner } from './Spinner';

export function RouteLoadingState() {
  const { t } = useTranslation('common');

  return (
    <main
      className="flex min-h-svh items-center justify-center bg-[var(--app-bg)] px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-[var(--shadow-soft)]">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-gray-600">{t('states.loading')}</p>
      </div>
    </main>
  );
}
