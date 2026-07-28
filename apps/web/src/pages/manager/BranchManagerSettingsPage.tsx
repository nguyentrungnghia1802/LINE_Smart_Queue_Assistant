import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Time24HourField } from '../../components/manager/Time24HourField';
import { get, patch, put } from '../../services/apiClient';

interface BranchInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string | null;
  latitude: string | null;
  longitude: string | null;
  timezone: string;
  payment_settings: {
    merchantName?: string;
    settlementMethod?: 'bank_transfer' | 'card' | 'paypay' | 'cash';
    bankName?: string;
    bankBranchName?: string;
    accountType?: 'ordinary' | 'checking';
    accountHolder?: string;
    accountNumberLast4?: string;
    invoiceRegistrationNumber?: string;
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

export function BranchManagerSettingsPage() {
  const { t } = useTranslation(['manager', 'common']);
  const client = useQueryClient();
  const weekdays = t('settings.weekdays', { returnObjects: true }) as string[];
  const branch = useQuery<BranchInfo>({
    queryKey: ['manager-my-branch'],
    queryFn: () => get('/api/v1/branches/me'),
  });
  const savedCalendar = useQuery<BusinessCalendar>({
    queryKey: ['manager-branch-business-calendar'],
    queryFn: () => get('/api/v1/branches/me/business-calendar'),
  });
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    latitude: '',
    longitude: '',
    merchantName: '',
    settlementMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'paypay' | 'cash',
    bankName: '',
    bankBranchName: '',
    accountType: 'ordinary' as 'ordinary' | 'checking',
    accountHolder: '',
    accountNumberLast4: '',
    invoiceRegistrationNumber: '',
  });
  const [calendar, setCalendar] = useState<BusinessCalendar | null>(null);

  useEffect(() => {
    if (!branch.data) return;
    setForm({
      name: branch.data.name,
      phone: branch.data.phone,
      email: branch.data.email ?? '',
      postalCode: branch.data.postal_code,
      prefecture: branch.data.prefecture,
      city: branch.data.city,
      addressLine1: branch.data.address_line1,
      addressLine2: branch.data.address_line2 ?? '',
      latitude: branch.data.latitude ?? '',
      longitude: branch.data.longitude ?? '',
      merchantName: branch.data.payment_settings?.merchantName ?? '',
      settlementMethod: branch.data.payment_settings?.settlementMethod ?? 'bank_transfer',
      bankName: branch.data.payment_settings?.bankName ?? '',
      bankBranchName: branch.data.payment_settings?.bankBranchName ?? '',
      accountType: branch.data.payment_settings?.accountType ?? 'ordinary',
      accountHolder: branch.data.payment_settings?.accountHolder ?? '',
      accountNumberLast4: branch.data.payment_settings?.accountNumberLast4 ?? '',
      invoiceRegistrationNumber: branch.data.payment_settings?.invoiceRegistrationNumber ?? '',
    });
  }, [branch.data]);

  useEffect(() => {
    if (savedCalendar.data) setCalendar(savedCalendar.data);
  }, [savedCalendar.data]);

  const save = useMutation({
    mutationFn: async () => {
      await patch('/api/v1/branches/me', {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        postalCode: form.postalCode,
        prefecture: form.prefecture,
        city: form.city,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        paymentSettings: {
          merchantName: form.merchantName || undefined,
          settlementMethod: form.settlementMethod,
          bankName: form.bankName || undefined,
          bankBranchName: form.bankBranchName || undefined,
          accountType: form.accountType,
          accountHolder: form.accountHolder || undefined,
          accountNumberLast4: form.accountNumberLast4 || undefined,
          invoiceRegistrationNumber: form.invoiceRegistrationNumber || undefined,
        },
      });
      if (calendar) {
        await put('/api/v1/branches/me/business-calendar', calendar);
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['manager-my-branch'] });
      void client.invalidateQueries({ queryKey: ['manager-branch-business-calendar'] });
    },
  });

  if (branch.isLoading || savedCalendar.isLoading) {
    return <p className="text-sm text-gray-500">{t('states.loading', { ns: 'common' })}</p>;
  }

  const fields = [
    ['name', t('branches.fields.name')],
    ['phone', t('branches.fields.phone')],
    ['email', t('branches.fields.email')],
    ['postalCode', t('branches.fields.postalCode')],
    ['prefecture', t('branches.fields.prefecture')],
    ['city', t('branches.fields.city')],
    ['addressLine1', t('branches.fields.addressLine1')],
    ['addressLine2', t('branches.fields.addressLine2')],
    ['latitude', t('branches.fields.latitude')],
    ['longitude', t('branches.fields.longitude')],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          {t('branches.contact')}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">{t('settings.branchTitle')}</h1>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="space-y-6"
      >
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-gray-950">{t('branches.contact')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label
                key={key}
                className={key.startsWith('addressLine') ? 'sm:col-span-2' : undefined}
              >
                <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
                <input
                  required={!['email', 'addressLine2', 'latitude', 'longitude'].includes(key)}
                  type={
                    key === 'email'
                      ? 'email'
                      : ['latitude', 'longitude'].includes(key)
                        ? 'number'
                        : 'text'
                  }
                  step={['latitude', 'longitude'].includes(key) ? '0.000001' : undefined}
                  placeholder={t(`branches.placeholders.${key}`)}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>
            ))}
          </div>
          {form.latitude && form.longitude && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-bold text-brand-700"
            >
              {t('branches.openMap')}
            </a>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-gray-950">{t('settings.branchPaymentTitle')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('settings.branchPaymentDescription')}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PaymentField
              label={t('settings.paymentMerchantName')}
              value={form.merchantName}
              placeholder={t('settings.paymentMerchantPlaceholder')}
              onChange={(value) => setForm((current) => ({ ...current, merchantName: value }))}
            />
            <label className="text-sm font-medium text-gray-700">
              {t('settings.paymentMethod')}
              <select
                value={form.settlementMethod}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    settlementMethod: event.target.value as typeof current.settlementMethod,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                {(['bank_transfer', 'card', 'paypay', 'cash'] as const).map((method) => (
                  <option key={method} value={method}>
                    {t(`settings.paymentMethods.${method}`)}
                  </option>
                ))}
              </select>
            </label>
            <PaymentField
              label={t('settings.bankName')}
              value={form.bankName}
              placeholder={t('settings.bankNamePlaceholder')}
              onChange={(value) => setForm((current) => ({ ...current, bankName: value }))}
            />
            <PaymentField
              label={t('settings.bankBranchName')}
              value={form.bankBranchName}
              placeholder={t('settings.bankBranchPlaceholder')}
              onChange={(value) => setForm((current) => ({ ...current, bankBranchName: value }))}
            />
            <label className="text-sm font-medium text-gray-700">
              {t('settings.accountType')}
              <select
                value={form.accountType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accountType: event.target.value as typeof current.accountType,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              >
                <option value="ordinary">{t('settings.accountTypes.ordinary')}</option>
                <option value="checking">{t('settings.accountTypes.checking')}</option>
              </select>
            </label>
            <PaymentField
              label={t('settings.accountHolder')}
              value={form.accountHolder}
              placeholder={t('settings.accountHolderPlaceholder')}
              onChange={(value) => setForm((current) => ({ ...current, accountHolder: value }))}
            />
            <PaymentField
              label={t('settings.accountNumberLast4')}
              value={form.accountNumberLast4}
              placeholder="1234"
              maxLength={4}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  accountNumberLast4: value.replace(/\D/g, '').slice(0, 4),
                }))
              }
            />
            <PaymentField
              label={t('settings.invoiceRegistrationNumber')}
              value={form.invoiceRegistrationNumber}
              placeholder="T1234567890123"
              maxLength={14}
              onChange={(value) =>
                setForm((current) => ({ ...current, invoiceRegistrationNumber: value }))
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-gray-950">{t('settings.businessHours')}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('settings.businessHoursTimezone', {
              timezone: branch.data?.timezone ?? 'Asia/Tokyo',
            })}
          </p>
          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {calendar?.weeklyHours.map((day, index) => (
              <div
                key={day.weekday}
                className="grid gap-3 p-3 sm:grid-cols-[80px_110px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
              >
                <strong className="text-sm text-gray-900">{weekdays[day.weekday]}</strong>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={day.isClosed}
                    onChange={(event) =>
                      setCalendar((current) =>
                        current
                          ? {
                              ...current,
                              weeklyHours: current.weeklyHours.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      isClosed: event.target.checked,
                                      opensAt: event.target.checked ? null : '09:00',
                                      closesAt: event.target.checked ? null : '18:00',
                                    }
                                  : item
                              ),
                            }
                          : current
                      )
                    }
                  />
                  {t('settings.closed')}
                </label>
                <Time24HourField
                  disabled={day.isClosed}
                  label={t('settings.openTimeLabel', { day: weekdays[day.weekday] })}
                  hourLabel={t('settings.hour')}
                  minuteLabel={t('settings.minute')}
                  value={day.opensAt}
                  onChange={(value) => updateHour(index, 'opensAt', value)}
                />
                <Time24HourField
                  disabled={day.isClosed}
                  label={t('settings.closeTimeLabel', { day: weekdays[day.weekday] })}
                  hourLabel={t('settings.hour')}
                  minuteLabel={t('settings.minute')}
                  value={day.closesAt}
                  onChange={(value) => updateHour(index, 'closesAt', value)}
                />
              </div>
            ))}
          </div>
        </section>

        {save.error && <p className="text-sm text-red-700">{save.error.message}</p>}
        {save.isSuccess && <p className="text-sm text-emerald-700">{t('settings.saved')}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {save.isPending
              ? t('actions.saving', { ns: 'common' })
              : t('actions.save', { ns: 'common' })}
          </button>
        </div>
      </form>
    </div>
  );

  function updateHour(index: number, key: 'opensAt' | 'closesAt', value: string) {
    setCalendar((current) =>
      current
        ? {
            ...current,
            weeklyHours: current.weeklyHours.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            ),
          }
        : current
    );
  }
}

function PaymentField({
  label,
  value,
  placeholder,
  onChange,
  maxLength,
}: Readonly<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  maxLength?: number;
}>) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
      />
    </label>
  );
}
