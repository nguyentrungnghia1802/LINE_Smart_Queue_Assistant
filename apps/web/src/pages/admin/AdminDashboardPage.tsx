import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

import type { OrgRow } from './AdminOrganizationsPage';

export function AdminDashboardPage() {
  const { t } = useTranslation('admin');
  const { data: orgs = [], isLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
  });

  const missingContact = orgs.filter((org) => !org.phone || !org.address).length;
  const missingPayment = orgs.filter((org) => !org.payment_info).length;
  const withLogo = orgs.filter((org) => Boolean(org.logo_url)).length;
  const recentOrgs = orgs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            {t('dashboard.section', { ns: 'admin' })}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('dashboard.description', { ns: 'admin' })}
          </p>
        </div>
        <Link
          to="/admin/orgs/register"
          className="inline-flex items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
        >
          {t('organizations.register')}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('dashboard.organizationCount')}
          value={isLoading ? '...' : String(orgs.length)}
        />
        <MetricCard
          label={t('dashboard.logoConfigured')}
          value={isLoading ? '...' : String(withLogo)}
        />
        <MetricCard
          label={t('dashboard.contactMissing')}
          value={isLoading ? '...' : String(missingContact)}
          tone="amber"
        />
        <MetricCard
          label={t('dashboard.paymentMissing')}
          value={isLoading ? '...' : String(missingPayment)}
          tone="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-950">
              {t('dashboard.recentOrganizations', { ns: 'admin' })}
            </h2>
          </div>
          {recentOrgs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">
              {t('dashboard.noOrganizations', { ns: 'admin' })}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrgs.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/orgs/${org.id}`}
                  className="grid gap-3 px-5 py-4 hover:bg-gray-50 sm:grid-cols-[1fr_140px_120px]"
                >
                  <div>
                    <p className="font-semibold text-gray-950">{org.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500">{org.slug}</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    {org.phone || t('dashboard.phoneMissing', { ns: 'admin' })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {org.payment_info
                      ? t('dashboard.paymentConfigured', { ns: 'admin' })
                      : t('dashboard.notConfigured', { ns: 'admin' })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-bold text-gray-950">{t('dashboard.checks', { ns: 'admin' })}</h2>
          <div className="mt-4 space-y-3">
            <CheckItem
              done={missingContact === 0}
              label={t('dashboard.allContactConfigured', { ns: 'admin' })}
            />
            <CheckItem
              done={missingPayment === 0}
              label={t('dashboard.allPaymentConfigured', { ns: 'admin' })}
            />
            <CheckItem
              done={withLogo === orgs.length && orgs.length > 0}
              label={t('dashboard.allLogosConfigured', { ns: 'admin' })}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: Readonly<{ label: string; value: string; tone?: 'default' | 'amber' | 'red' }>) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800'
      : tone === 'red'
        ? 'bg-red-50 text-red-700'
        : 'bg-brand-50 text-brand-800';
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-3 inline-flex rounded-xl px-3 py-1 text-3xl font-bold ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function CheckItem({ done, label }: Readonly<{ done: boolean; label: string }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-brand-600 text-white' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {done ? '✓' : '!'}
      </span>
      <p className="text-sm text-gray-700">{label}</p>
    </div>
  );
}
