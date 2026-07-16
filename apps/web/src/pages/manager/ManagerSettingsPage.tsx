import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLocale } from '@line-queue/shared';

import { get, patch, put } from '../../services/apiClient';
import { uploadImage } from '../../services/media.api';
import { useAuthStore } from '../../store/authStore';
import { compressLogoFile } from '../../utils/compressLogoFile';

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
  defaultLocale: SupportedLocale;
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

export function ManagerSettingsPage() {
  const { t } = useTranslation(['manager', 'common']);
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
    defaultLocale: 'ja' as SupportedLocale,
  });
  const [saved, setSaved] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);
  const [error, setError] = useState('');
  const [calendar, setCalendar] = useState<BusinessCalendar | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setError('');
    try {
      const dataUrl = await compressLogoFile(file);
      const asset = await uploadImage(dataUrl, 'organization_logo');
      setOrgForm((value) => ({ ...value, logoUrl: asset.public_url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('settings.uploadFailed'));
    } finally {
      setLogoBusy(false);
    }
  }

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
      defaultLocale: org.defaultLocale ?? 'ja',
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
    onError: () => setError(t('settings.saveFailed')),
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
      defaultLocale?: SupportedLocale;
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
    onError: () => setError(t('settings.saveFailed')),
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
      defaultLocale: orgForm.defaultLocale,
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
  const weekdays = t('settings.weekdays', { returnObjects: true }) as string[];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          {t('settings.section')}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">
          {t('settings.title', { ns: 'manager' })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('settings.description')}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-sm font-semibold text-gray-700">{t('settings.personalInfo')}</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('labels.displayName', { ns: 'common' })}
          </label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('labels.email', { ns: 'common' })}
          </label>
          <input
            className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
            value={email}
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">{t('settings.emailLocked')}</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-green-600">{t('settings.saved')}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-gray-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {mutation.isPending ? t('actions.saving', { ns: 'common' }) : t('settings.saveChanges')}
        </button>
      </form>

      <form
        onSubmit={handleOrgSubmit}
        className="space-y-5 rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-sm font-semibold text-gray-700">{t('settings.organizationInfo')}</h2>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          {t('settings.defaultLocale', { ns: 'manager' })}
          <select
            value={orgForm.defaultLocale}
            onChange={(event) =>
              setOrgForm((value) => ({
                ...value,
                defaultLocale: event.target.value as SupportedLocale,
              }))
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ja">{t('language.ja', { ns: 'common' })}</option>
            <option value="vi">{t('language.vi', { ns: 'common' })}</option>
            <option value="en">{t('language.en', { ns: 'common' })}</option>
          </select>
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.organizationName')}
          </label>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            value={orgForm.name}
            onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.organizationLogo')}
          </label>
          <div className="flex items-center gap-4">
            {orgForm.logoUrl && (
              <img
                src={orgForm.logoUrl}
                alt={t('settings.logoAlt')}
                className="h-16 w-16 rounded-lg object-cover"
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={logoBusy}
              onChange={(e) => void handleLogo(e.target.files?.[0])}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>
          {logoBusy && (
            <p className="mt-1 text-xs text-gray-500">{t('settings.processingImage')}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('labels.phone', { ns: 'common' })}
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.phone}
              onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.postalCode')}
            </label>
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
            {t('settings.prefecture')}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.prefecture}
              onChange={(e) => setOrgForm((f) => ({ ...f, prefecture: e.target.value }))}
              placeholder={t('settings.prefecture')}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {t('settings.city')}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.city}
              onChange={(e) => setOrgForm((f) => ({ ...f, city: e.target.value }))}
              placeholder={t('settings.city')}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {t('settings.addressLine1')}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.addressLine1}
              onChange={(e) => setOrgForm((f) => ({ ...f, addressLine1: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {t('settings.addressLine2')}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              value={orgForm.addressLine2}
              onChange={(e) => setOrgForm((f) => ({ ...f, addressLine2: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.latitude')}
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              value={orgForm.latitude}
              onChange={(e) => setOrgForm((f) => ({ ...f, latitude: e.target.value }))}
              inputMode="decimal"
              placeholder="35.681236"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.longitude')}
            </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.paymentInfo')}
          </label>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            rows={4}
            value={orgForm.paymentInfo}
            onChange={(e) => setOrgForm((f) => ({ ...f, paymentInfo: e.target.value }))}
          />
        </div>

        <div className="grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700">{t('settings.businessHours')}</h3>
            <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {calendar?.weeklyHours.map((day, index) => (
                <div
                  key={day.weekday}
                  className="grid grid-cols-[32px_1fr] items-center gap-3 p-3 sm:grid-cols-[32px_110px_1fr_1fr]"
                >
                  <strong className="text-sm">{weekdays[day.weekday]}</strong>
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
                    {t('settings.closedDay')}
                  </label>
                  <input
                    aria-label={t('settings.openTimeLabel', { day: weekdays[day.weekday] })}
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
                    aria-label={t('settings.closeTimeLabel', { day: weekdays[day.weekday] })}
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
                <h4 className="text-sm font-semibold text-gray-700">{t('settings.holidays')}</h4>
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
                  {t('settings.addDate')}
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {calendar?.exceptionDays.map((day, index) => (
                  <div
                    key={`${day.date}-${index}`}
                    className="grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[150px_1fr_auto]"
                  >
                    <input
                      aria-label={t('settings.exceptionDate')}
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
                      aria-label={t('settings.exceptionReason')}
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
                      placeholder={t('settings.exceptionReasonPlaceholder')}
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
                      {t('actions.delete', { ns: 'common' })}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">{t('settings.paymentProvider')}</h3>
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
                placeholder={t('settings.merchantId')}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={orgForm.demoMode}
                  onChange={(e) => setOrgForm((f) => ({ ...f, demoMode: e.target.checked }))}
                />
                {t('settings.demoMode')}
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
            {t('settings.lineNotifications')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={orgForm.retryEnabled}
              onChange={(e) => setOrgForm((f) => ({ ...f, retryEnabled: e.target.checked }))}
            />
            {t('settings.retry')}
          </label>
          <label className="block text-sm text-gray-700">
            {t('settings.notifyBeforeTurns')}
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('settings.publicQrToken')}
              </label>
              <input
                readOnly
                value={org?.publicQrToken ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('settings.publicJoinUrl')}
              </label>
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
                  {t('settings.copy')}
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

        {orgSaved && <p className="text-sm text-green-600">{t('settings.organizationSaved')}</p>}

        <button
          type="submit"
          disabled={orgMutation.isPending}
          className="rounded-xl bg-gray-950 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {orgMutation.isPending
            ? t('actions.saving', { ns: 'common' })
            : t('settings.saveOrganization')}
        </button>
      </form>
    </div>
  );
}
