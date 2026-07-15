import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { get, patch } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  paymentInfo: string | null;
  publicQrToken: string | null;
  joinUrl: string | null;
  settings?: {
    businessHours?: { open?: string; close?: string; holidays?: string };
    paymentProvider?: { provider?: string; merchantId?: string; demoMode?: boolean };
    notificationPreferences?: {
      lineEnabled?: boolean;
      retryEnabled?: boolean;
      notifyBeforeTurns?: number;
    };
  };
}

export function ManagerSettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [orgForm, setOrgForm] = useState({
    name: '',
    logoUrl: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    paymentInfo: '',
    businessOpen: '09:00',
    businessClose: '18:00',
    holidays: '',
    paymentProvider: 'demo',
    merchantId: '',
    demoMode: true,
    lineEnabled: true,
    retryEnabled: true,
    notifyBeforeTurns: 3,
  });
  const [saved, setSaved] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [error, setError] = useState('');

  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get<OrgInfo>('/api/v1/orgs/my-org'),
  });

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  useEffect(() => {
    if (!org) return;
    setOrgForm({
      name: org.name,
      logoUrl: org.logoUrl ?? '',
      address: org.address ?? '',
      latitude: org.latitude ?? '',
      longitude: org.longitude ?? '',
      phone: org.phone ?? '',
      paymentInfo: org.paymentInfo ?? '',
      businessOpen: org.settings?.businessHours?.open ?? '09:00',
      businessClose: org.settings?.businessHours?.close ?? '18:00',
      holidays: org.settings?.businessHours?.holidays ?? '',
      paymentProvider: org.settings?.paymentProvider?.provider ?? 'demo',
      merchantId: org.settings?.paymentProvider?.merchantId ?? '',
      demoMode: org.settings?.paymentProvider?.demoMode ?? true,
      lineEnabled: org.settings?.notificationPreferences?.lineEnabled ?? true,
      retryEnabled: org.settings?.notificationPreferences?.retryEnabled ?? true,
      notifyBeforeTurns: org.settings?.notificationPreferences?.notifyBeforeTurns ?? 3,
    });
  }, [org]);

  const mutation = useMutation({
    mutationFn: (dto: { displayName: string }) =>
      patch<{ displayName: string; email: string }>('/api/v1/users/me', dto),
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, displayName: data.displayName, email: data.email });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => setError('エラーが発生しました。もう一度お試しください。'),
  });

  const orgMutation = useMutation({
    mutationFn: (dto: {
      name: string;
      logoUrl?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      phone?: string | null;
      paymentInfo?: string | null;
      settings?: Record<string, unknown>;
    }) => patch<OrgInfo>('/api/v1/orgs/my-org', dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-my-org'] });
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    },
    onError: () => setError('エラーが発生しました。もう一度お試しください。'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate({ displayName });
  }

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    orgMutation.mutate({
      name: orgForm.name,
      logoUrl: orgForm.logoUrl.trim() || null,
      address: orgForm.address.trim() || null,
      latitude: orgForm.latitude.trim() ? Number(orgForm.latitude) : null,
      longitude: orgForm.longitude.trim() ? Number(orgForm.longitude) : null,
      phone: orgForm.phone.trim() || null,
      paymentInfo: orgForm.paymentInfo.trim() || null,
      settings: {
        businessHours: {
          open: orgForm.businessOpen,
          close: orgForm.businessClose,
          holidays: orgForm.holidays.trim(),
        },
        paymentProvider: {
          provider: orgForm.paymentProvider.trim() || 'demo',
          merchantId: orgForm.merchantId.trim(),
          demoMode: orgForm.demoMode,
        },
        notificationPreferences: {
          lineEnabled: orgForm.lineEnabled,
          retryEnabled: orgForm.retryEnabled,
          notifyBeforeTurns: orgForm.notifyBeforeTurns,
        },
      },
    });
  }

  const joinUrl =
    org?.joinUrl ?? (org?.publicQrToken ? `${window.location.origin}/qr/${org.publicQrToken}` : '');

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">設定</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">設定</h1>
        <p className="mt-1 text-sm text-gray-500">店舗情報、支払い、通知設定を管理します。</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-sm font-semibold text-gray-700">個人情報</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メール</label>
          <input
            className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
            value={email}
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">メールは変更できません</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-600">保存しました。</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-gray-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {mutation.isPending ? '保存中...' : '変更を保存'}
        </button>
      </form>

      <form
        onSubmit={handleOrgSubmit}
        className="space-y-5 rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-sm font-semibold text-gray-700">組織情報</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">組織名</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            value={orgForm.name}
            onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            value={orgForm.logoUrl}
            onChange={(e) => setOrgForm((f) => ({ ...f, logoUrl: e.target.value }))}
            type="url"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.phone}
              onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.address}
              onChange={(e) => setOrgForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">緯度</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.latitude}
              onChange={(e) => setOrgForm((f) => ({ ...f, latitude: e.target.value }))}
              inputMode="decimal"
              placeholder="35.681236"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">経度</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.longitude}
              onChange={(e) => setOrgForm((f) => ({ ...f, longitude: e.target.value }))}
              inputMode="decimal"
              placeholder="139.767125"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">支払い情報</label>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            rows={4}
            value={orgForm.paymentInfo}
            onChange={(e) => setOrgForm((f) => ({ ...f, paymentInfo: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">営業時間</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                type="time"
                value={orgForm.businessOpen}
                onChange={(e) => setOrgForm((f) => ({ ...f, businessOpen: e.target.value }))}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <input
                type="time"
                value={orgForm.businessClose}
                onChange={(e) => setOrgForm((f) => ({ ...f, businessClose: e.target.value }))}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
            </div>
            <textarea
              rows={2}
              value={orgForm.holidays}
              onChange={(e) => setOrgForm((f) => ({ ...f, holidays: e.target.value }))}
              placeholder="定休日・特別休業日"
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">支払いプロバイダー</h3>
            <div className="mt-3 grid gap-3">
              <input
                value={orgForm.paymentProvider}
                onChange={(e) => setOrgForm((f) => ({ ...f, paymentProvider: e.target.value }))}
                placeholder="demo / stripe / paypay / komoju"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <input
                value={orgForm.merchantId}
                onChange={(e) => setOrgForm((f) => ({ ...f, merchantId: e.target.value }))}
                placeholder="加盟店ID"
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={orgForm.demoMode}
                  onChange={(e) => setOrgForm((f) => ({ ...f, demoMode: e.target.checked }))}
                />
                デモモード
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={orgForm.lineEnabled}
              onChange={(e) => setOrgForm((f) => ({ ...f, lineEnabled: e.target.checked }))}
            />
            LINE通知
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={orgForm.retryEnabled}
              onChange={(e) => setOrgForm((f) => ({ ...f, retryEnabled: e.target.checked }))}
            />
            再送信
          </label>
          <label className="block text-sm text-gray-700">
            何番前に通知
            <input
              type="number"
              min={1}
              max={20}
              value={orgForm.notifyBeforeTurns}
              onChange={(e) =>
                setOrgForm((f) => ({ ...f, notifyBeforeTurns: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">公開QRトークン</label>
              <input
                readOnly
                value={org?.publicQrToken ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">公開受付URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={joinUrl}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(joinUrl)}
                  className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  コピー
                </button>
              </div>
            </div>
          </div>
          {joinUrl && (
            <div className="flex items-center justify-center">
              <QRCodeSVG value={joinUrl} size={120} />
            </div>
          )}
        </div>

        {orgSaved && <p className="text-sm text-green-600">組織情報を保存しました。</p>}

        <button
          type="submit"
          disabled={orgMutation.isPending}
          className="rounded-xl bg-gray-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {orgMutation.isPending ? '保存中...' : '組織を保存'}
        </button>
      </form>
    </div>
  );
}
