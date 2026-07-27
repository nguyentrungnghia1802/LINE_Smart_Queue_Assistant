import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    });
  }, [branch.data]);

  useEffect(() => {
    if (savedCalendar.data) setCalendar(savedCalendar.data);
  }, [savedCalendar.data]);

  const save = useMutation({
    mutationFn: async () => {
      await patch('/api/v1/branches/me', {
        ...form,
        email: form.email || null,
        addressLine2: form.addressLine2 || null,
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
                  required={!['email', 'addressLine2'].includes(key)}
                  type={key === 'email' ? 'email' : 'text'}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-gray-950">{t('settings.businessHours')}</h2>
          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {calendar?.weeklyHours.map((day, index) => (
              <div
                key={day.weekday}
                className="grid gap-3 p-3 sm:grid-cols-[80px_120px_1fr_1fr] sm:items-center"
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
                <input
                  type="time"
                  disabled={day.isClosed}
                  value={day.opensAt ?? ''}
                  onChange={(event) => updateHour(index, 'opensAt', event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                />
                <input
                  type="time"
                  disabled={day.isClosed}
                  value={day.closesAt ?? ''}
                  onChange={(event) => updateHour(index, 'closesAt', event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
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
