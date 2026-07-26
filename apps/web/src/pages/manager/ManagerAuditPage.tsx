import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { get } from '../../services/apiClient';

type Audit = {
  id: string;
  actor_name: string | null;
  action: string;
  resource_type: string;
  created_at: string;
};
export function ManagerAuditPage() {
  const { t, i18n } = useTranslation('manager');
  const { data = [] } = useQuery<Audit[]>({
    queryKey: ['organization-audit'],
    queryFn: () => get('/api/v1/branches/audit?limit=200'),
  });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('audit.description')}</p>
      </header>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {data.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">{t('audit.empty')}</p>
        ) : (
          data.map((item) => (
            <article
              key={item.id}
              className="grid gap-1 border-b p-4 last:border-0 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-bold">
                  {t(`audit.actions.${item.action}`, { defaultValue: item.action })}
                </p>
                <p className="text-sm text-gray-500">
                  {item.actor_name ?? t('audit.system')} · {item.resource_type}
                </p>
              </div>
              <time className="text-xs text-gray-500">
                {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(item.created_at))}
              </time>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
