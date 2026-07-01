import { Link, Navigate } from 'react-router-dom';

import { useAuthStore } from '../store/authStore';

export function AccountPage() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">アカウント情報</h1>
            <p className="mt-1 text-sm text-gray-500">ログイン中のユーザー情報を確認できます。</p>
          </div>
          <Link to="/" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            ダッシュボードへ戻る
          </Link>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <dl className="divide-y divide-gray-100">
            <InfoRow label="表示名" value={user.displayName} />
            <InfoRow label="メール" value={user.email} />
            <InfoRow label="権限" value={user.role} />
            <InfoRow label="組織ID" value={user.organizationId} mono />
            <InfoRow label="ユーザーID" value={user.id} mono />
          </dl>
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value?: string | null; mono?: boolean }>) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className={`break-all text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || '-'}
      </dd>
    </div>
  );
}
