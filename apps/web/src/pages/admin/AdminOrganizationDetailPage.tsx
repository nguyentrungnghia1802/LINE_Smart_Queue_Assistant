import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { API_BASE_PATH } from '@line-queue/shared';

import { del, get, patch, post } from '../../services/apiClient';
import { compressLogoFile } from '../../utils/compressLogoFile';

import type { OrgRow } from './AdminOrganizationsPage';

interface ManagerRow {
  id: string;
  display_name: string;
  email: string | null;
}

interface OrgForm {
  name: string;
  slug: string;
  logoUrl: string;
  phone: string;
  address: string;
  paymentInfo: string;
}

interface ManagerForm {
  displayName: string;
  email: string;
  password: string;
}

const emptyOrgForm: OrgForm = {
  name: '',
  slug: '',
  logoUrl: '',
  phone: '',
  address: '',
  paymentInfo: '',
};

const emptyManagerForm: ManagerForm = { displayName: '', email: '', password: '' };

export function AdminOrganizationDetailPage() {
  const { orgId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orgForm, setOrgForm] = useState<OrgForm>(emptyOrgForm);
  const [managerForm, setManagerForm] = useState<ManagerForm>(emptyManagerForm);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  const { data: orgs = [], isLoading: orgsLoading } = useQuery<OrgRow[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => get<OrgRow[]>(`${API_BASE_PATH}/admin/organizations`),
  });

  const org = useMemo(() => orgs.find((item) => item.id === orgId) ?? null, [orgId, orgs]);

  const { data: managers = [], isLoading: managersLoading } = useQuery<ManagerRow[]>({
    queryKey: ['admin-org-managers', orgId],
    queryFn: () => get<ManagerRow[]>(`${API_BASE_PATH}/admin/organizations/${orgId}/managers`),
    enabled: Boolean(orgId),
  });

  useEffect(() => {
    if (!org) return;
    setOrgForm({
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url ?? '',
      phone: org.phone ?? '',
      address: org.address ?? '',
      paymentInfo: org.payment_info ?? '',
    });
  }, [org]);

  const refreshOrgs = () => queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
  const refreshManagers = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-org-managers', orgId] });
  const onError = (err: unknown) =>
    setError(err instanceof Error ? err.message : '操作に失敗しました。');

  const updateOrg = useMutation({
    mutationFn: () =>
      patch<OrgRow>(`${API_BASE_PATH}/admin/organizations/${orgId}`, orgPayload(orgForm)),
    onSuccess: () => {
      void refreshOrgs();
      setError('');
    },
    onError,
  });

  const removeOrg = useMutation({
    mutationFn: () => del(`${API_BASE_PATH}/admin/organizations/${orgId}`),
    onSuccess: () => {
      void refreshOrgs();
      navigate('/admin/orgs');
    },
    onError,
  });

  const createManager = useMutation({
    mutationFn: () =>
      post<ManagerRow>(`${API_BASE_PATH}/admin/organizations/${orgId}/managers`, managerForm),
    onSuccess: () => {
      void refreshManagers();
      resetManagerForm();
    },
    onError,
  });

  const updateManager = useMutation({
    mutationFn: () =>
      patch<ManagerRow>(
        `${API_BASE_PATH}/admin/organizations/${orgId}/managers/${editingManagerId}`,
        {
          displayName: managerForm.displayName,
          email: managerForm.email,
          ...(managerForm.password ? { password: managerForm.password } : {}),
        }
      ),
    onSuccess: () => {
      void refreshManagers();
      resetManagerForm();
    },
    onError,
  });

  const removeManager = useMutation({
    mutationFn: (managerId: string) =>
      del(`${API_BASE_PATH}/admin/organizations/${orgId}/managers/${managerId}`),
    onSuccess: () => void refreshManagers(),
    onError,
  });

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    setError('');
    setLogoBusy(true);
    try {
      const logoUrl = await compressLogoFile(file);
      setOrgForm((value) => ({ ...value, logoUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像を処理できませんでした。');
    } finally {
      setLogoBusy(false);
    }
  }

  function resetManagerForm() {
    setEditingManagerId(null);
    setManagerForm(emptyManagerForm);
    setError('');
  }

  function startEditManager(manager: ManagerRow) {
    setEditingManagerId(manager.id);
    setManagerForm({ displayName: manager.display_name, email: manager.email ?? '', password: '' });
    setError('');
  }

  function submitOrg(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    updateOrg.mutate();
  }

  function submitManager(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (editingManagerId) updateManager.mutate();
    else createManager.mutate();
  }

  if (orgsLoading) {
    return <p className="text-sm text-gray-500">組織を読み込み中...</p>;
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">組織が見つかりません。</p>
        <Link to="/admin/orgs" className="text-sm font-medium text-brand-700">
          組織一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">組織</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{org.name}</h1>
          <p className="mt-1 text-sm text-gray-500">組織の詳細情報とマネージャーを管理します。</p>
        </div>
        <Link
          to="/admin/orgs"
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          組織一覧へ戻る
        </Link>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={`${org.name} ロゴ`}
                className="h-24 w-24 rounded-2xl border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-xl font-semibold text-gray-500">
                {org.name.slice(0, 1)}
              </div>
            )}
            <dl className="space-y-2 text-sm">
              <InfoRow label="スラッグ" value={org.slug} mono />
              <InfoRow label="QRトークン" value={org.public_qr_token ?? '-'} mono />
              <InfoRow label="電話番号" value={org.phone ?? '-'} />
              <InfoRow label="住所" value={org.address ?? '-'} />
              <InfoRow label="支払い情報" value={org.payment_info ?? '-'} />
            </dl>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${org.name} を削除しますか?`)) removeOrg.mutate();
            }}
            className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            組織を削除
          </button>
        </div>
      </section>

      <form
        onSubmit={submitOrg}
        className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-lg font-bold text-gray-950">組織情報を編集</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput
            label="組織名"
            value={orgForm.name}
            onChange={(name) => setOrgForm((value) => ({ ...value, name }))}
            required
          />
          <TextInput
            label="スラッグ"
            value={orgForm.slug}
            onChange={(slug) => setOrgForm((value) => ({ ...value, slug }))}
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            required
          />
          <TextInput
            label="電話番号"
            value={orgForm.phone}
            onChange={(phone) => setOrgForm((value) => ({ ...value, phone }))}
          />
          <TextInput
            label="住所"
            value={orgForm.address}
            onChange={(address) => setOrgForm((value) => ({ ...value, address }))}
          />
          <TextInput
            label="支払い情報"
            value={orgForm.paymentInfo}
            onChange={(paymentInfo) => setOrgForm((value) => ({ ...value, paymentInfo }))}
            className="md:col-span-2"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
          <div className="h-36 w-36 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            {orgForm.logoUrl ? (
              <img
                src={orgForm.logoUrl}
                alt="ロゴプレビュー"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                ロゴ
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">ロゴ画像</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void handleLogoChange(e.target.files?.[0])}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-2 text-xs text-gray-500">
              {logoBusy ? '画像を圧縮中...' : '画像はアップロード時に自動で圧縮されます。'}
            </p>
          </label>
        </div>

        <button
          type="submit"
          disabled={updateOrg.isPending || logoBusy}
          className="mt-4 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          組織を保存
        </button>
      </form>

      <form
        onSubmit={submitManager}
        className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {editingManagerId ? 'マネージャーを編集' : 'マネージャーを追加'}
          </h2>
          {editingManagerId && (
            <button type="button" onClick={resetManagerForm} className="text-sm text-gray-500">
              編集をキャンセル
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            label="表示名"
            value={managerForm.displayName}
            onChange={(displayName) => setManagerForm((value) => ({ ...value, displayName }))}
            required
          />
          <TextInput
            label="Gmail"
            type="email"
            value={managerForm.email}
            onChange={(email) => setManagerForm((value) => ({ ...value, email }))}
            pattern=".+@gmail\.com"
            required
          />
          <TextInput
            label={editingManagerId ? '新しいパスワード' : 'パスワード'}
            type="password"
            value={managerForm.password}
            onChange={(password) => setManagerForm((value) => ({ ...value, password }))}
            required={!editingManagerId}
          />
        </div>
        <button
          type="submit"
          disabled={createManager.isPending || updateManager.isPending}
          className="mt-4 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {editingManagerId ? 'マネージャーを保存' : 'マネージャーを追加'}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">マネージャー一覧</h2>
        </div>
        {managersLoading ? (
          <p className="p-4 text-sm text-gray-500">マネージャーを読み込み中...</p>
        ) : managers.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">マネージャーが登録されていません。</p>
        ) : (
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {managers.map((manager) => (
                <tr key={manager.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{manager.display_name}</div>
                    <div className="text-gray-500">{manager.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEditManager(manager)}
                      className="rounded-md px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`${manager.display_name} を削除しますか?`)) {
                          removeManager.mutate(manager.id);
                        }
                      }}
                      className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  pattern,
  className = '',
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  pattern?: string;
  className?: string;
}>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value}
        type={type}
        required={required}
        pattern={pattern}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    </label>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`break-all text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function orgPayload(form: OrgForm) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    logoUrl: form.logoUrl || null,
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    paymentInfo: form.paymentInfo.trim() || null,
  };
}
