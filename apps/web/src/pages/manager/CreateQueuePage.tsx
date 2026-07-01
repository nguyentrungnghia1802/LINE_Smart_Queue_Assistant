import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface QueueRow {
  id: string;
  name: string;
}

export function CreateQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    prefix: '',
    maxCapacity: '',
    avgServiceTimeMinutes: '',
    autoNoShowMinutes: '',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.organizationId) {
      setError('所属組織がありません。');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const queue = await post<QueueRow>('/api/v1/queues', {
        orgId: user.organizationId,
        name: form.name,
        description: form.description || undefined,
        prefix: form.prefix || undefined,
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
        avgServiceMs: form.avgServiceTimeMinutes
          ? parseInt(form.avgServiceTimeMinutes) * 60 * 1000
          : undefined,
      });
      navigate(`/queues/${queue.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'キューの作成中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← キュー
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">新しいキューを作成</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <Field label="キュー名 *" required>
          <input
            required
            type="text"
            placeholder="例: 一般受付"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="説明">
          <textarea
            rows={2}
            placeholder="キューの短い説明"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="受付番号のプレフィックス">
            <input
              type="text"
              placeholder="例: A"
              maxLength={10}
              value={form.prefix}
              onChange={(e) => set('prefix', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="最大定員">
            <input
              type="number"
              min="1"
              placeholder="無制限"
              value={form.maxCapacity}
              onChange={(e) => set('maxCapacity', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="平均対応時間（分）">
            <input
              type="number"
              min="1"
              placeholder="例: 15"
              value={form.avgServiceTimeMinutes}
              onChange={(e) => set('avgServiceTimeMinutes', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="呼び出し後の自動キャンセル（分）">
            <input
              type="number"
              min="1"
              placeholder="例: 10"
              value={form.autoNoShowMinutes}
              onChange={(e) => set('autoNoShowMinutes', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link
            to="/queues"
            className="flex-1 text-center border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? '作成中...' : 'キューを作成'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
