import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
      setNotice('通知設定を保存しました。');
    },
  });
  const deleteLocation = useMutation({
    mutationFn: () => del<{ deletedSnapshots: number }>('/api/v1/line/location-data'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['location-consent'] });
      setNotice('位置情報の共有を停止し、保存データを削除しました。');
    },
  });

  if (preferences.isLoading || location.isLoading) {
    return <p className="py-12 text-center text-sm text-gray-500">設定を読み込んでいます…</p>;
  }
  if (!preferences.data) {
    return <p className="py-12 text-center text-sm text-red-600">設定を読み込めませんでした。</p>;
  }

  const data = preferences.data;
  const change = (key: keyof Preferences, checked: boolean) => {
    updatePreferences.mutate({ ...data, [key]: checked });
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-950">通知・プライバシー設定</h1>
        <p className="mt-1 text-sm text-gray-500">LINE通知と位置情報をいつでも変更できます。</p>
      </div>
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>
      )}
      <section className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-4">
        <Toggle
          label="LINE通知"
          checked={data.notification_enabled}
          onChange={(v) => change('notification_enabled', v)}
        />
        <Toggle
          label="順番が近い通知"
          checked={data.approaching_enabled}
          onChange={(v) => change('approaching_enabled', v)}
        />
        <Toggle
          label="呼び出し通知"
          checked={data.called_enabled}
          onChange={(v) => change('called_enabled', v)}
        />
        <Toggle
          label="完了・キャンセル通知"
          checked={data.lifecycle_enabled}
          onChange={(v) => change('lifecycle_enabled', v)}
        />
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">位置情報</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          予約時に共有した一時的な位置情報のみを使用し、継続的な追跡は行いません。
        </p>
        <button
          type="button"
          onClick={() => deleteLocation.mutate()}
          disabled={deleteLocation.isPending || !location.data?.enabled}
          className="mt-4 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
        >
          共有を停止してデータを削除
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
