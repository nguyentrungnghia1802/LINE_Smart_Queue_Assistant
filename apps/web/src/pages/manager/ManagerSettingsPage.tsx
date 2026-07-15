import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { get, patch, put } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
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

interface BusinessCalendar {
  weeklyHours: Array<{
    weekday: number;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
  }>;
  exceptionDays: Array<{
    date: string;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
    reason: string | null;
  }>;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function ManagerSettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [orgForm, setOrgForm] = useState({
    name: '',
    logoUrl: '',
    address: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    latitude: '',
    longitude: '',
    phone: '',
    paymentInfo: '',
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
  const [calendar, setCalendar] = useState<BusinessCalendar | null>(null);

  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['manager-my-org'],
    queryFn: () => get<OrgInfo>('/api/v1/orgs/my-org'),
  });
  const { data: savedCalendar } = useQuery<BusinessCalendar>({
    queryKey: ['manager-business-calendar'],
    queryFn: () => get<BusinessCalendar>('/api/v1/orgs/my-org/business-calendar'),
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
      postalCode: org.postalCode ?? '',
      prefecture: org.prefecture ?? '',
      city: org.city ?? '',
      addressLine1: org.addressLine1 ?? '',
      addressLine2: org.addressLine2 ?? '',
      latitude: org.latitude ?? '',
      longitude: org.longitude ?? '',
      phone: org.phone ?? '',
      paymentInfo: org.paymentInfo ?? '',
      paymentProvider: org.settings?.paymentProvider?.provider ?? 'demo',
      merchantId: org.settings?.paymentProvider?.merchantId ?? '',
      demoMode: org.settings?.paymentProvider?.demoMode ?? true,
      lineEnabled: org.settings?.notificationPreferences?.lineEnabled ?? true,
      retryEnabled: org.settings?.notificationPreferences?.retryEnabled ?? true,
      notifyBeforeTurns: org.settings?.notificationPreferences?.notifyBeforeTurns ?? 3,
    });
  }, [org]);

  useEffect(() => {
    if (savedCalendar) setCalendar(savedCalendar);
  }, [savedCalendar]);

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
    mutationFn: async (dto: {
      name: string;
      logoUrl?: string | null;
      address?: string | null;
      postalCode?: string | null;
      prefecture?: string | null;
      city?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      phone?: string | null;
      paymentInfo?: string | null;
      settings?: Record<string, unknown>;
    }) => {
      const updated = await patch<OrgInfo>('/api/v1/orgs/my-org', dto);
      if (calendar) {
        await put<BusinessCalendar>('/api/v1/orgs/my-org/business-calendar', calendar);
      }
      return updated;
    },
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
      postalCode: orgForm.postalCode.trim() || null,
      prefecture: orgForm.prefecture.trim() || null,
      city: orgForm.city.trim() || null,
      addressLine1: orgForm.addressLine1.trim() || null,
      addressLine2: orgForm.addressLine2.trim() || null,
      latitude: orgForm.latitude.trim() ? Number(orgForm.latitude) : null,
      longitude: orgForm.longitude.trim() ? Number(orgForm.longitude) : null,
      phone: orgForm.phone.trim() || null,
      paymentInfo: orgForm.paymentInfo.trim() || null,
      settings: {
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.phone}
              onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.postalCode}
              onChange={(e) => setOrgForm((f) => ({ ...f, postalCode: e.target.value }))}
              placeholder="100-0001"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            都道府県
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.prefecture}
              onChange={(e) => setOrgForm((f) => ({ ...f, prefecture: e.target.value }))}
              placeholder="東京都"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            市区町村
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.city}
              onChange={(e) => setOrgForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="千代田区"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            町名・番地
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.addressLine1}
              onChange={(e) => setOrgForm((f) => ({ ...f, addressLine1: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            建物名・部屋番号
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.addressLine2}
              onChange={(e) => setOrgForm((f) => ({ ...f, addressLine2: e.target.value }))}
            />
          </label>
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
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700">営業時間</h3>
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {calendar?.weeklyHours.map((day, index) => (
                <div
                  key={day.weekday}
                  className="grid grid-cols-[32px_1fr] items-center gap-3 p-3 sm:grid-cols-[32px_110px_1fr_1fr]"
                >
                  <strong className="text-sm">{WEEKDAYS[day.weekday]}</strong>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={day.isClosed}
                      onChange={(e) =>
                        setCalendar((current) =>
                          current
                            ? {
                                ...current,
                                weeklyHours: current.weeklyHours.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        isClosed: e.target.checked,
                                        opensAt: e.target.checked ? null : '09:00',
                                        closesAt: e.target.checked ? null : '18:00',
                                      }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                    />
                    休業日
                  </label>
                  <input
                    aria-label={`${WEEKDAYS[day.weekday]}曜日の開店時間`}
                    type="time"
                    disabled={day.isClosed}
                    value={day.opensAt ?? ''}
                    onChange={(e) =>
                      setCalendar((current) =>
                        current
                          ? {
                              ...current,
                              weeklyHours: current.weeklyHours.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, opensAt: e.target.value } : item
                              ),
                            }
                          : current
                      )
                    }
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  />
                  <input
                    aria-label={`${WEEKDAYS[day.weekday]}曜日の閉店時間`}
                    type="time"
                    disabled={day.isClosed}
                    value={day.closesAt ?? ''}
                    onChange={(e) =>
                      setCalendar((current) =>
                        current
                          ? {
                              ...current,
                              weeklyHours: current.weeklyHours.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, closesAt: e.target.value } : item
                              ),
                            }
                          : current
                      )
                    }
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">祝日・臨時休業</h4>
                <button
                  type="button"
                  onClick={() =>
                    setCalendar((current) =>
                      current
                        ? {
                            ...current,
                            exceptionDays: [
                              ...current.exceptionDays,
                              {
                                date: '',
                                isClosed: true,
                                opensAt: null,
                                closesAt: null,
                                reason: null,
                              },
                            ],
                          }
                        : current
                    )
                  }
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold"
                >
                  日付を追加
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {calendar?.exceptionDays.map((day, index) => (
                  <div
                    key={`${day.date}-${index}`}
                    className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[150px_1fr_auto]"
                  >
                    <input
                      aria-label="例外日"
                      type="date"
                      value={day.date}
                      onChange={(e) =>
                        setCalendar((current) =>
                          current
                            ? {
                                ...current,
                                exceptionDays: current.exceptionDays.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, date: e.target.value } : item
                                ),
                              }
                            : current
                        )
                      }
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      aria-label="例外日の理由"
                      value={day.reason ?? ''}
                      onChange={(e) =>
                        setCalendar((current) =>
                          current
                            ? {
                                ...current,
                                exceptionDays: current.exceptionDays.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, reason: e.target.value || null }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                      placeholder="祝日・臨時休業の理由"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCalendar((current) =>
                          current
                            ? {
                                ...current,
                                exceptionDays: current.exceptionDays.filter(
                                  (_, itemIndex) => itemIndex !== index
                                ),
                              }
                            : current
                        )
                      }
                      className="rounded-lg px-3 py-2 text-xs font-bold text-red-600"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
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
