import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { SupportedLocale } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  public_qr_token: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  payment_info: string | null;
  created_at?: string;
  default_locale: SupportedLocale;
}

export function AdminOrganizationsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: orgs = [], isLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('organizations.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('organizations.listDescription')}</p>
        </div>
        <Link
          to="/admin/orgs/register"
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t('organizations.register')}
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-[64px_1fr_160px_160px] gap-3 border-b border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 max-md:hidden">
          <span>{t('organizations.logo')}</span>
          <span>{t('organizations.name')}</span>
          <span>{t('organizations.slug')}</span>
          <span>{t('labels.phone', { ns: 'common' })}</span>
        </div>

        {isLoading ? (
          <p className="px-4 py-6 text-sm text-gray-500">{t('organizations.loading')}</p>
        ) : orgs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-900">{t('organizations.empty')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('organizations.registerFirst')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orgs.map((org) => (
              <Link
                key={org.id}
                to={`/admin/orgs/${org.id}`}
                className="grid grid-cols-[56px_1fr] gap-3 px-4 py-4 hover:bg-gray-50 md:grid-cols-[64px_1fr_160px_160px]"
              >
                <Logo src={org.logo_url} name={org.name} />
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-900">{org.name}</div>
                  <div className="mt-1 truncate text-xs font-mono text-gray-500 md:hidden">
                    {org.slug}
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-500 md:hidden">
                    {org.phone || t('organizations.phoneMissing')}
                  </div>
                </div>
                <div className="hidden self-center truncate font-mono text-sm text-gray-600 md:block">
                  {org.slug}
                </div>
                <div className="hidden self-center truncate text-sm text-gray-600 md:block">
                  {org.phone || '-'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Logo({ src, name }: Readonly<{ src: string | null; name: string }>) {
  const { t } = useTranslation('admin');
  if (src) {
    return (
      <img
        src={src}
        alt={t('organizations.logoAlt', { name })}
        className="h-12 w-12 rounded-md border border-gray-200 object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-500">
      {name.slice(0, 1)}
    </div>
  );
}
