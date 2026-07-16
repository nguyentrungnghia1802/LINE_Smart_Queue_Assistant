import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface QueueRow {
  id: string;
  name: string;
}

export function CreateQueuePage() {
  const { t } = useTranslation(['manager', 'common']);
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
      setError(t('queue.organizationMissing'));
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
      setError(err instanceof Error ? err.message : t('queue.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← {t('nav.queue', { ns: 'common' })}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{t('queue.createTitle')}</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <Field label={t('queue.nameRequired')} required>
          <input
            required
            type="text"
            placeholder={t('queue.namePlaceholder')}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label={t('labels.description', { ns: 'common' })}>
          <textarea
            rows={2}
            placeholder={t('queue.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('queue.prefix')}>
            <input
              type="text"
              placeholder="A"
              maxLength={10}
              value={form.prefix}
              onChange={(e) => set('prefix', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t('queue.capacity')}>
            <input
              type="number"
              min="1"
              placeholder={t('units.unlimited', { ns: 'common' })}
              value={form.maxCapacity}
              onChange={(e) => set('maxCapacity', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('queue.averageService')}>
            <input
              type="number"
              min="1"
              placeholder="15"
              value={form.avgServiceTimeMinutes}
              onChange={(e) => set('avgServiceTimeMinutes', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t('queue.autoCancel')}>
            <input
              type="number"
              min="1"
              placeholder="10"
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
            {t('actions.cancel', { ns: 'common' })}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? t('queue.creating') : t('queue.create')}
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
