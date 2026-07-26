import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { formatCurrency } from '../../i18n/format';
import { ApiClientError, del, get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  stock_quantity: number | null;
  product_type: 'product' | 'service';
  is_active: boolean;
}

export function ManagerProductsPage() {
  const { t, i18n } = useTranslation(['manager', 'common']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: products = [], isLoading } = useQuery<ProductRow[]>({
    queryKey: ['products', orgId],
    queryFn: () => get<ProductRow[]>(`/api/v1/products?orgId=${orgId}`),
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/api/v1/products/${id}`),
    onMutate: () => setDeleteError(''),
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData<ProductRow[]>(['products', orgId], (current) =>
        current?.filter((product) => product.id !== deletedId)
      );
      void queryClient.invalidateQueries({ queryKey: ['products', orgId] });
      setConfirmId(null);
    },
    onError: (deleteProductError) => {
      const code =
        deleteProductError instanceof ApiClientError ? deleteProductError.code : 'UNKNOWN';
      setDeleteError(t('products.deleteFailed', { code }));
    },
  });

  if (isLoading)
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('products.title')}</h1>
        <Link
          to="/manager/products/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + {t('products.create')}
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('products.empty')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100 md:hidden">
            {products.map((product) => (
              <article key={product.id} className="p-4">
                <div className="flex min-w-0 gap-3">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-400">
                      {product.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-gray-900">{product.name}</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          {product.product_type === 'service'
                            ? t('labels.service', { ns: 'common' })
                            : t('labels.product', { ns: 'common' })}
                          {' · '}
                          {t('units.minutes', {
                            ns: 'common',
                            count: product.service_time_minutes,
                          })}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-gray-950">
                        {formatCurrency(Number(product.price), i18n.resolvedLanguage ?? 'ja')}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {t('products.stock')}: {product.stock_quantity ?? '∞'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                  <Link
                    to={`/manager/products/${product.id}`}
                    className="rounded-lg bg-gray-100 px-2 py-2 text-center text-xs font-semibold text-gray-700"
                  >
                    {t('actions.open', { ns: 'common' })}
                  </Link>
                  <Link
                    to={`/manager/products/${product.id}/edit`}
                    className="rounded-lg bg-blue-50 px-2 py-2 text-center text-xs font-semibold text-blue-700"
                  >
                    {t('actions.edit', { ns: 'common' })}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setConfirmId(product.id);
                    }}
                    className="rounded-lg bg-red-50 px-2 py-2 text-xs font-semibold text-red-600"
                  >
                    {t('actions.delete', { ns: 'common' })}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3 font-medium">{t('labels.name', { ns: 'common' })}</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('products.type')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('labels.price', { ns: 'common' })}
                </th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
                  {t('products.duration')}
                </th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
                  {t('products.stock')}
                </th>
                <th className="px-4 py-3 font-medium text-center">{t('products.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                          ?
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${p.product_type === 'service' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {p.product_type === 'service'
                        ? t('labels.service', { ns: 'common' })
                        : t('labels.product', { ns: 'common' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(Number(p.price), i18n.resolvedLanguage ?? 'ja')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                    {t('units.minutes', { ns: 'common', count: p.service_time_minutes })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                    {p.stock_quantity ?? '∞'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/manager/products/${p.id}`}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        {t('actions.open', { ns: 'common' })}
                      </Link>
                      <Link
                        to={`/manager/products/${p.id}/edit`}
                        className="text-gray-600 hover:underline text-xs"
                      >
                        {t('actions.edit', { ns: 'common' })}
                      </Link>
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setConfirmId(p.id);
                        }}
                        className="text-red-500 hover:underline text-xs"
                      >
                        {t('actions.delete', { ns: 'common' })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <p className="text-sm text-gray-700 mb-4">{t('products.deleteConfirm')}</p>
            {deleteError && (
              <p
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {deleteError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteError('');
                  setConfirmId(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('actions.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {t('actions.delete', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
