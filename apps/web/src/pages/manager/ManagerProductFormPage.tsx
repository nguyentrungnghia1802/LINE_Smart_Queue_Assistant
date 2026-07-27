import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiClientError, get, patch, post } from '../../services/apiClient';
import { uploadImage } from '../../services/media.api';
import { useAuthStore } from '../../store/authStore';
import { compressLogoFile } from '../../utils/compressLogoFile';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  max_wait_minutes: number | null;
  requires_prepayment: boolean;
  stock_quantity: number | null;
  product_type: 'product' | 'service';
  is_active: boolean;
  queue_ids: string[];
}

interface QueueRow {
  id: string;
  name: string;
}

interface FormState {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  serviceTimeMinutes: string;
  maxWaitMinutes: string;
  requiresPrepayment: boolean;
  stockQuantity: string;
  productType: 'product' | 'service';
  isActive: boolean;
  queueIds: string[];
}

const empty: FormState = {
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  serviceTimeMinutes: '30',
  maxWaitMinutes: '',
  requiresPrepayment: false,
  stockQuantity: '',
  productType: 'service',
  isActive: true,
  queueIds: [],
};

export function ManagerProductFormPage() {
  const { t } = useTranslation(['manager', 'common']);
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setImageBusy(true);
    setError('');
    setErrorFields([]);
    try {
      const dataUrl = await compressLogoFile(file);
      const asset = await uploadImage(dataUrl, 'product_image');
      setForm((value) => ({ ...value, imageUrl: asset.public_url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('products.uploadFailed'));
    } finally {
      setImageBusy(false);
    }
  }

  const { data: existing } = useQuery<ProductRow>({
    queryKey: ['product', id],
    queryFn: () => get<ProductRow>(`/api/v1/products/${id}`),
    enabled: isEdit,
  });
  const { data: queues = [] } = useQuery<QueueRow[]>({
    queryKey: ['manager-queues'],
    queryFn: () => get<QueueRow[]>('/api/v1/queues'),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description ?? '',
        imageUrl: existing.image_url ?? '',
        price: existing.price,
        serviceTimeMinutes: String(existing.service_time_minutes),
        maxWaitMinutes: existing.max_wait_minutes ? String(existing.max_wait_minutes) : '',
        requiresPrepayment: existing.requires_prepayment,
        stockQuantity: existing.stock_quantity !== null ? String(existing.stock_quantity) : '',
        productType: existing.product_type ?? 'service',
        isActive: existing.is_active,
        queueIds: existing.queue_ids ?? [],
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      isEdit ? patch(`/api/v1/products/${id}`, dto) : post(`/api/v1/products`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', orgId] });
      if (id) void queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate('/manager/products', { replace: true });
    },
    onError: (saveError) => {
      if (saveError instanceof ApiClientError && saveError.code === 'VALIDATION_ERROR') {
        const fields = getValidationFields(saveError.details);
        setErrorFields(fields);
        setError(
          t('products.validationFailed', {
            code: saveError.code,
            fields: fields.map((field) => productFieldLabel(t, field)).join('、'),
          })
        );
        return;
      }

      setError(saveError instanceof Error ? saveError.message : t('products.saveFailed'));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setErrorFields([]);
    const dto: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      price: parseFloat(form.price),
      serviceTimeMinutes: parseInt(form.serviceTimeMinutes),
      maxWaitMinutes: form.maxWaitMinutes ? parseInt(form.maxWaitMinutes) : undefined,
      requiresPrepayment: form.requiresPrepayment,
      stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity) : undefined,
      productType: form.productType,
      queueIds: form.queueIds,
    };
    if (isEdit) dto.isActive = form.isActive;
    mutation.mutate(dto);
  }

  function field(label: string, input: React.ReactNode) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {input}
      </div>
    );
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold text-gray-900">
        {isEdit ? t('products.formEdit') : t('products.create')}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        {field(
          t('products.nameRequired'),
          <input
            className={inputCls}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        )}
        {field(
          t('products.typeRequired'),
          <select
            className={inputCls}
            value={form.productType}
            onChange={(e) =>
              setForm((f) => {
                const productType = e.target.value as 'product' | 'service';
                return {
                  ...f,
                  productType,
                  stockQuantity: productType === 'service' ? '' : f.stockQuantity,
                };
              })
            }
          >
            <option value="service">{t('labels.service', { ns: 'common' })}</option>
            <option value="product">{t('labels.product', { ns: 'common' })}</option>
          </select>
        )}
        {field(
          t('labels.description', { ns: 'common' }),
          <textarea
            className={inputCls}
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        )}
        {field(
          t('products.image'),
          <div className="space-y-2">
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt={t('products.preview')}
                className="h-32 w-full rounded-lg object-cover"
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={imageBusy}
              onChange={(e) => void handleImage(e.target.files?.[0])}
              className={inputCls}
            />
            <p className="text-xs text-gray-500">
              {imageBusy ? t('settings.processingImage') : t('products.imageHint')}
            </p>
          </div>
        )}
        {field(
          t('products.priceYenRequired'),
          <input
            className={inputCls}
            type="number"
            min={form.requiresPrepayment ? 1 : 0}
            required
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        )}
        {field(
          t('products.serviceTimeRequired'),
          <input
            className={inputCls}
            type="number"
            min={1}
            required
            value={form.serviceTimeMinutes}
            onChange={(e) => setForm((f) => ({ ...f, serviceTimeMinutes: e.target.value }))}
          />
        )}
        {field(
          t('products.maxWait'),
          <input
            className={inputCls}
            type="number"
            min={1}
            value={form.maxWaitMinutes}
            onChange={(e) => setForm((f) => ({ ...f, maxWaitMinutes: e.target.value }))}
          />
        )}
        {form.productType === 'product' &&
          field(
            t('products.stockOptional'),
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.stockQuantity}
              onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
            />
          )}
        {field(
          t('products.queuesRequired'),
          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
            {queues.map((queue) => (
              <label key={queue.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.queueIds.includes(queue.id)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      queueIds: event.target.checked
                        ? [...current.queueIds, queue.id]
                        : current.queueIds.filter((queueId) => queueId !== queue.id),
                    }))
                  }
                />
                {queue.name}
              </label>
            ))}
            {queues.length === 0 && (
              <p className="text-xs text-amber-700">{t('products.queueRequiredHint')}</p>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.requiresPrepayment}
            onChange={(e) => setForm((f) => ({ ...f, requiresPrepayment: e.target.checked }))}
          />
          {t('products.requirePrepayment')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          {t('products.enabled')}
        </label>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <p className="font-medium">{error}</p>
            {errorFields.includes('imageUrl') && (
              <p className="mt-1 text-xs leading-5">{t('products.imageUrlValidationHint')}</p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/manager/products')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || form.queueIds.length === 0}
            className="px-6 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending
              ? t('actions.saving', { ns: 'common' })
              : t('actions.save', { ns: 'common' })}
          </button>
        </div>
      </form>
    </div>
  );
}

function getValidationFields(details: unknown): string[] {
  if (!details || typeof details !== 'object') return [];
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return [];

  return Object.keys(fieldErrors as Record<string, unknown>);
}

function productFieldLabel(t: (key: string) => string, field: string): string {
  const labels: Record<string, string> = {
    name: t('products.nameRequired'),
    imageUrl: t('products.image'),
    price: t('products.priceYenRequired'),
    serviceTimeMinutes: t('products.serviceTimeRequired'),
    maxWaitMinutes: t('products.maxWait'),
    stockQuantity: t('products.stockOptional'),
    queueIds: t('products.queuesRequired'),
  };

  return labels[field] ?? field;
}
