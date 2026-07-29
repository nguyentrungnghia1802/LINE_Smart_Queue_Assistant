import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const [search, setSearch] = useState('');
  const visibleAudit = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.filter(
      (item) =>
        !query ||
        item.action.toLocaleLowerCase().includes(query) ||
        item.resource_type.toLocaleLowerCase().includes(query) ||
        item.actor_name?.toLocaleLowerCase().includes(query)
    );
  }, [data, search]);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('audit.description')}</p>
      </header>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('audit.search')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('audit.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {visibleAudit.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">{t('audit.empty')}</p>
        ) : (
          visibleAudit.map((item, index) => (
            <article
              key={item.id}
              className="grid gap-1 border-b p-4 last:border-0 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-bold">
                  <span className="mr-2 text-gray-400">{index + 1}.</span>
                  {t(`audit.actions.${item.action.replace(/\./g, '_')}`, {
                    defaultValue: item.action,
                  })}
                </p>
                <p className="text-sm text-gray-500">
                  {item.actor_name ?? t('audit.system')} ·{' '}
                  {t(`audit.resources.${item.resource_type}`, {
                    defaultValue: item.resource_type,
                  })}
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
