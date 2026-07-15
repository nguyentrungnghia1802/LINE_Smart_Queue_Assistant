import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { API_BASE_PATH } from '@line-queue/shared';

import { post } from '../../services/apiClient';
import { uploadImage } from '../../services/media.api';
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

interface RegisterResponse {
  organization: OrgRow;
  manager: ManagerRow;
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

export function AdminOrganizationRegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orgForm, setOrgForm] = useState<OrgForm>(emptyOrgForm);
  const [managerForm, setManagerForm] = useState<ManagerForm>(emptyManagerForm);
  const [error, setError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  const registerOrg = useMutation({
    mutationFn: () =>
      post<RegisterResponse>(`${API_BASE_PATH}/admin/organizations/register`, {
        organization: orgPayload(orgForm),
        manager: managerForm,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-orgs'] });
      navigate(`/admin/orgs/${result.organization.id}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : '登録に失敗しました。'),
  });

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    setError('');
    setLogoBusy(true);
    try {
      const dataUrl = await compressLogoFile(file);
      const asset = await uploadImage(dataUrl, 'organization_logo');
      setOrgForm((value) => ({ ...value, logoUrl: asset.public_url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像を処理できませんでした。');
    } finally {
      setLogoBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    registerOrg.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">組織登録</h1>
          <p className="mt-1 text-sm text-gray-500">
            組織情報とマネージャーアカウントを同時に登録します。
          </p>
        </div>
        <Link to="/admin/orgs" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          組織一覧へ戻る
        </Link>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">組織情報</h2>
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
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">マネージャーアカウント</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
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
              label="パスワード"
              type="password"
              value={managerForm.password}
              onChange={(password) => setManagerForm((value) => ({ ...value, password }))}
              required
            />
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={registerOrg.isPending || logoBusy}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            組織を登録
          </button>
        </div>
      </form>
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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
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
