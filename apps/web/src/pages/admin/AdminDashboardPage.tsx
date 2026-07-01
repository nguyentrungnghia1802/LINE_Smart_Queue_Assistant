import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { API_BASE_PATH } from '@line-queue/shared';

import { get } from '../../services/apiClient';

import type { OrgRow } from './AdminOrganizationsPage';

export function AdminDashboardPage() {
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">管理</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">管理者ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-500">
            組織の登録状況と運用設定の不足を確認できます。
          </p>
        </div>
        <Link
          to="/admin/orgs/register"
          className="inline-flex items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
        >
          組織を登録
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="組織数" value={isLoading ? '...' : String(orgs.length)} />
        <MetricCard label="ロゴ設定済み" value={isLoading ? '...' : String(withLogo)} />
        <MetricCard
          label="連絡先未設定"
          value={isLoading ? '...' : String(missingContact)}
          tone="amber"
        />
        <MetricCard
          label="支払い情報未設定"
          value={isLoading ? '...' : String(missingPayment)}
          tone="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-bold text-gray-950">最近登録された組織</h2>
          </div>
          {recentOrgs.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">組織がまだ登録されていません。</p>
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
                  <p className="text-sm text-gray-600">{org.phone || '電話未設定'}</p>
                  <p className="text-sm text-gray-500">
                    {org.payment_info ? '支払い設定済み' : '未設定'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="font-bold text-gray-950">管理チェック</h2>
          <div className="mt-4 space-y-3">
            <CheckItem done={missingContact === 0} label="全組織に住所・電話番号が設定済み" />
            <CheckItem done={missingPayment === 0} label="全組織に支払い情報が設定済み" />
            <CheckItem
              done={withLogo === orgs.length && orgs.length > 0}
              label="全組織にロゴが設定済み"
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
