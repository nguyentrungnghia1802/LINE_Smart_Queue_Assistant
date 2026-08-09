import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { NUMERIC_LIMITS } from '@line-queue/shared';

import {
  type QueueProductOption,
  QueueProductPicker,
} from '../../components/products/QueueProductPicker';
import { BoundedNumberInput } from '../../components/ui/BoundedNumberInput';
import { get, post } from '../../services/apiClient';
import { type ApiFieldErrors, getApiFieldErrors, INPUT_LIMITS } from '../../utils/formValidation';

interface QueueRow {
  id: string;
  name: string;
}

export function CreateQueuePage() {
  const { t } = useTranslation(['manager', 'common']);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [form, setForm] = useState({
    name: '',
    description: '',
    prefix: '',
    status: 'open',
    maxCapacity: '',
    avgServiceTimeMinutes: '',
    absenceGraceMinutes: '5',
    productIds: [] as string[],
  });

  const { data: products = [] } = useQuery({
    queryKey: ['manager-products-for-queue'],
    queryFn: () => get<QueueProductOption[]>('/api/v1/products'),
  });

  function set(field: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSaving(true);
    try {
      const queue = await post<QueueRow>('/api/v1/queues', {
        name: form.name,
        description: form.description || undefined,
        status: form.status,
        prefix: form.prefix || undefined,
        maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity) : undefined,
        avgServiceTimeMinutes: form.avgServiceTimeMinutes
          ? parseInt(form.avgServiceTimeMinutes)
          : undefined,
        absenceGraceMinutes: parseInt(form.absenceGraceMinutes),
        productIds: form.productIds,
      });
      navigate(`/manager/queues/${queue.id}`);
    } catch (err: unknown) {
      setFieldErrors(getApiFieldErrors(err));
      setError(err instanceof Error ? err.message : t('queue.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/manager/queues" className="text-gray-400 hover:text-gray-600 text-sm">
          ← {t('nav.queue', { ns: 'common' })}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{t('queue.createTitle')}</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
      >
        <Field label={t('queue.nameRequired')} required error={fieldErrors['name']?.[0]}>
          <input
            name="name"
            required
            type="text"
            maxLength={INPUT_LIMITS.queueName}
            placeholder={t('queue.namePlaceholder')}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label={t('labels.description', { ns: 'common' })}
          error={fieldErrors['description']?.[0]}
        >
          <textarea
            name="description"
            rows={2}
            maxLength={INPUT_LIMITS.shortDescription}
            placeholder={t('queue.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label={t('labels.status', { ns: 'common' })}>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputCls}
          >
            <option value="open">{t('queue.open')}</option>
            <option value="paused">{t('states.paused', { ns: 'common' })}</option>
            <option value="closed">{t('states.closed', { ns: 'common' })}</option>
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('queue.prefix')} error={fieldErrors['prefix']?.[0]}>
            <input
              name="prefix"
              type="text"
              placeholder="A"
              maxLength={10}
              value={form.prefix}
              onChange={(e) => set('prefix', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={t('queue.capacity')} error={fieldErrors['maxCapacity']?.[0]}>
            <BoundedNumberInput
              name="maxCapacity"
              min={NUMERIC_LIMITS.queueCapacity.min}
              max={NUMERIC_LIMITS.queueCapacity.max}
              placeholder={t('units.unlimited', { ns: 'common' })}
              value={form.maxCapacity}
              onValueChange={(value) => set('maxCapacity', value)}
              className={inputCls}
            />
          </Field>
          <Field label={t('queue.absenceGrace')} error={fieldErrors['absenceGraceMinutes']?.[0]}>
            <BoundedNumberInput
              name="absenceGraceMinutes"
              min={NUMERIC_LIMITS.queueAbsenceGraceMinutes.min}
              max={NUMERIC_LIMITS.queueAbsenceGraceMinutes.max}
              required
              placeholder="5"
              value={form.absenceGraceMinutes}
              onValueChange={(value) => set('absenceGraceMinutes', value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label={t('queue.products')} error={fieldErrors['productIds']?.[0]}>
          <QueueProductPicker
            products={products}
            selectedIds={form.productIds}
            onChange={(ids) => set('productIds', ids)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('queue.averageService')}
            error={fieldErrors['avgServiceTimeMinutes']?.[0]}
          >
            <BoundedNumberInput
              name="avgServiceTimeMinutes"
              min={NUMERIC_LIMITS.queueServiceMinutes.min}
              max={NUMERIC_LIMITS.queueServiceMinutes.max}
              placeholder="15"
              value={form.avgServiceTimeMinutes}
              onValueChange={(value) => set('avgServiceTimeMinutes', value)}
              className={inputCls}
            />
          </Field>
        </div>
        <p className="-mt-3 text-xs leading-5 text-gray-500">{t('queue.timingHint')}</p>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link
            to="/manager/queues"
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
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
