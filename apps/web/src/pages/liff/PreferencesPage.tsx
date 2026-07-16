import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { del, get, put } from '../../services/apiClient';

interface Preferences {
  notification_enabled: boolean;
  approaching_enabled: boolean;
  called_enabled: boolean;
  lifecycle_enabled: boolean;
  follow_state: string;
}

interface LocationConsent {
  enabled: boolean;
}

export function PreferencesPage() {
  const { t } = useTranslation(['customer', 'common']);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const preferences = useQuery({
    queryKey: ['line-preferences'],
    queryFn: () => get<Preferences>('/api/v1/line/preferences'),
  });
  const location = useQuery({
    queryKey: ['location-consent'],
    queryFn: () => get<LocationConsent>('/api/v1/line/location-consent'),
  });
  const updatePreferences = useMutation({
    mutationFn: (next: Preferences) =>
      put('/api/v1/line/preferences', {
        notificationEnabled: next.notification_enabled,
        approachingEnabled: next.approaching_enabled,
        calledEnabled: next.called_enabled,
        lifecycleEnabled: next.lifecycle_enabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['line-preferences'] });
      setNotice(t('preferences.saved', { ns: 'customer' }));
    },
  });
  const deleteLocation = useMutation({
    mutationFn: () => del<{ deletedSnapshots: number }>('/api/v1/line/location-data'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['location-consent'] });
      setNotice(t('preferences.locationDeleted', { ns: 'customer' }));
    },
  });

  if (preferences.isLoading || location.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        {t('states.loading', { ns: 'common' })}
      </p>
    );
  }
  if (!preferences.data) {
    return (
      <p className="py-12 text-center text-sm text-red-600">
        {t('preferences.loadFailed', { ns: 'customer' })}
      </p>
    );
  }

  const data = preferences.data;
  const change = (key: keyof Preferences, checked: boolean) => {
    updatePreferences.mutate({ ...data, [key]: checked });
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-950">
          {t('preferences.pageTitle', { ns: 'customer' })}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('preferences.description', { ns: 'customer' })}
        </p>
      </div>
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>
      )}
      <section className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-4">
        <Toggle
          label={t('preferences.line', { ns: 'customer' })}
          checked={data.notification_enabled}
          onChange={(v) => change('notification_enabled', v)}
        />
        <Toggle
          label={t('preferences.approaching', { ns: 'customer' })}
          checked={data.approaching_enabled}
          onChange={(v) => change('approaching_enabled', v)}
        />
        <Toggle
          label={t('preferences.called', { ns: 'customer' })}
          checked={data.called_enabled}
          onChange={(v) => change('called_enabled', v)}
        />
        <Toggle
          label={t('preferences.lifecycle', { ns: 'customer' })}
          checked={data.lifecycle_enabled}
          onChange={(v) => change('lifecycle_enabled', v)}
        />
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">
          {t('preferences.location', { ns: 'customer' })}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          {t('preferences.locationDescription', { ns: 'customer' })}
        </p>
        <button
          type="button"
          onClick={() => deleteLocation.mutate()}
          disabled={deleteLocation.isPending || !location.data?.enabled}
          className="mt-4 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
        >
          {t('preferences.deleteLocation', { ns: 'customer' })}
        </button>
      </section>
    </div>
  );
}

function Toggle(
  props: Readonly<{ label: string; checked: boolean; onChange: (value: boolean) => void }>
) {
  return (
    <label className="flex items-center justify-between gap-4 py-4 text-sm font-medium text-gray-800">
      {props.label}
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="h-5 w-5 accent-green-600"
      />
    </label>
  );
}
