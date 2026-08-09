import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { SupportedLocale } from '@line-queue/shared';
import { API_BASE_PATH } from '@line-queue/shared';

import { Pagination } from '../../components/ui/Pagination';
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
  subscription_plan: 'starter' | 'standard' | 'scale';
}

export function AdminOrganizationsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: orgs = [], isLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const visibleOrganizations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return orgs.filter(
      (org) =>
        !query ||
        org.name.toLocaleLowerCase().includes(query) ||
        org.slug.toLocaleLowerCase().includes(query)
    );
  }, [orgs, search]);
  const pageOrganizations = visibleOrganizations.slice((page - 1) * 15, page * 15);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('organizations.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('organizations.listDescription')}</p>
        </div>
        <Link
          to="/admin/applications"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
        >
          {t('applications.viewApplications')}
        </Link>
      </div>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('organizations.search')}</span>
        <input
          type="search"
          name="organizationSearch"
          maxLength={160}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t('organizations.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-[48px_64px_minmax(0,1fr)_160px_160px] gap-3 border-b border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 max-md:hidden">
          <span>{t('labels.number', { ns: 'common' })}</span>
          <span>{t('organizations.logo')}</span>
          <span>{t('organizations.name')}</span>
          <span>{t('organizations.slug')}</span>
          <span>{t('labels.phone', { ns: 'common' })}</span>
        </div>

        {isLoading ? (
          <p className="px-4 py-6 text-sm text-gray-500">{t('organizations.loading')}</p>
        ) : visibleOrganizations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-900">{t('organizations.empty')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('organizations.registerFirst')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageOrganizations.map((org, index) => (
              <Link
                key={org.id}
                to={`/admin/orgs/${org.id}`}
                className="grid grid-cols-[32px_56px_minmax(0,1fr)] items-center gap-3 px-4 py-4 hover:bg-gray-50 md:grid-cols-[48px_64px_minmax(0,1fr)_160px_160px]"
              >
                <span className="self-center text-left text-sm text-gray-500">
                  {(page - 1) * 15 + index + 1}
                </span>
                <Logo src={org.logo_url} name={org.name} />
                <div className="min-w-0 self-center">
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
      <Pagination
        page={page}
        totalItems={visibleOrganizations.length}
        onPageChange={setPage}
        previousLabel={t('pagination.previous', { ns: 'common' })}
        nextLabel={t('pagination.next', { ns: 'common' })}
        pageLabel={(current, total) =>
          t('pagination.page', { ns: 'common', page: current, totalPages: total })
        }
      />
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
