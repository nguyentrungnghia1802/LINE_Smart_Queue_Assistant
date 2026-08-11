import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency } from '../../i18n/format';
import { ApiClientError, del, get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface ProductRow {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  stock_quantity: number | null;
  low_stock_threshold?: number;
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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const isOwner = user?.isOrganizationOwner === true;

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
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter(
      (product) =>
        (typeFilter === 'all' || product.product_type === typeFilter) &&
        (!lowStockOnly ||
          (product.stock_quantity !== null &&
            product.stock_quantity < (product.low_stock_threshold ?? 10))) &&
        (!query ||
          product.name.toLocaleLowerCase().includes(query) ||
          product.product_code.toLocaleLowerCase().includes(query))
    );
  }, [lowStockOnly, products, search, typeFilter]);
  const lowStockProducts = products.filter(
    (product) =>
      product.stock_quantity !== null &&
      product.stock_quantity < (product.low_stock_threshold ?? 10)
  );
  const pageProducts = filteredProducts.slice((page - 1) * 15, page * 15);

  if (isLoading)
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('products.title')}</h1>
        {isOwner && (
          <Link
            to="/manager/products/new"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            + {t('products.create')}
          </Link>
        )}
      </div>
      {!isOwner && lowStockProducts.length > 0 && (
        <button
          type="button"
          onClick={() => setLowStockOnly((value) => !value)}
          className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800"
        >
          <span className="font-bold">{t('products.lowStockAlert')}</span>
          <span>{lowStockProducts.map((product) => product.product_code).join(', ')}</span>
        </button>
      )}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3">
          <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <span className="sr-only">{t('products.search')}</span>
          <input
            type="search"
            name="productSearch"
            maxLength={160}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('products.searchPlaceholder')}
            className="min-w-0 flex-1 border-0 py-2 text-sm outline-none"
          />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
          {(['all', 'product', 'service'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                typeFilter === type ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t(`products.filters.${type}`)}
            </button>
          ))}
        </div>
        {!isOwner && (
          <button
            type="button"
            onClick={() => setLowStockOnly((value) => !value)}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${
              lowStockOnly ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t('products.filters.lowStock')}
          </button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('products.empty')}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100 md:hidden">
            {pageProducts.map((product, index) => (
              <article
                key={product.id}
                className={`p-4 ${!isOwner && product.stock_quantity !== null && product.stock_quantity < (product.low_stock_threshold ?? 10) ? 'bg-red-50/60' : ''}`}
              >
                <div className="flex min-w-0 gap-3">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
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
                        <h2 className="truncate font-bold text-gray-900">
                          {(page - 1) * 15 + index + 1}. {product.name}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">
                          <span className="font-mono font-bold">{product.product_code}</span>
                          {' · '}
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
                    {!isOwner && (
                      <p className="mt-2 text-xs text-gray-500">
                        {t('products.stock')}: {product.stock_quantity ?? '∞'}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className={`mt-4 grid gap-2 border-t border-gray-100 pt-3 ${isOwner ? 'grid-cols-3' : 'grid-cols-1'}`}
                >
                  <Link
                    to={`/manager/products/${product.id}`}
                    className="rounded-lg bg-gray-100 px-2 py-2 text-center text-xs font-semibold text-gray-700"
                  >
                    {t('actions.open', { ns: 'common' })}
                  </Link>
                  {isOwner && (
                    <Link
                      to={`/manager/products/${product.id}/edit`}
                      className="rounded-lg bg-blue-50 px-2 py-2 text-center text-xs font-semibold text-blue-700"
                    >
                      {t('actions.edit', { ns: 'common' })}
                    </Link>
                  )}
                  {isOwner && (
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
                  )}
                </div>
              </article>
            ))}
          </div>

          <table className="hidden w-full table-fixed text-sm md:table">
            <colgroup>
              <col className="w-14" />
              <col className="w-28" />
              <col />
              <col className="w-24" />
              <col className="w-32" />
              <col className="w-24" />
              {!isOwner && <col className="w-20" />}
              <col className={isOwner ? 'w-36' : 'w-20'} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                <th className="w-14 px-4 py-3 text-left font-medium">
                  {t('labels.number', { ns: 'common' })}
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">{t('products.code')}</th>
                <th className="px-4 py-3 font-medium">{t('labels.name', { ns: 'common' })}</th>
                <th className="hidden whitespace-nowrap px-4 py-3 font-medium sm:table-cell">
                  {t('products.type')}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {t('labels.price', { ns: 'common' })}
                </th>
                <th className="hidden whitespace-nowrap px-4 py-3 text-right font-medium sm:table-cell">
                  {t('products.duration')}
                </th>
                {!isOwner && (
                  <th className="hidden whitespace-nowrap px-4 py-3 text-right font-medium md:table-cell">
                    {t('products.stock')}
                  </th>
                )}
                <th className="whitespace-nowrap px-4 py-3 text-center font-medium">
                  {t('products.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageProducts.map((p, index) => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 last:border-0 ${!isOwner && p.stock_quantity !== null && p.stock_quantity < (p.low_stock_threshold ?? 10) ? 'bg-red-50/60' : ''}`}
                >
                  <td className="px-4 py-3 text-left text-gray-500">
                    {(page - 1) * 15 + index + 1}
                  </td>
                  <td
                    className="truncate whitespace-nowrap px-4 py-3 font-mono text-xs font-bold text-gray-700"
                    title={p.product_code}
                  >
                    {p.product_code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                          ?
                        </div>
                      )}
                      <span className="min-w-0 truncate font-medium text-gray-800" title={p.name}>
                        {p.name}
                      </span>
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
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                    {formatCurrency(Number(p.price), i18n.resolvedLanguage ?? 'ja')}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right text-gray-500 sm:table-cell">
                    {t('units.minutes', { ns: 'common', count: p.service_time_minutes })}
                  </td>
                  {!isOwner && (
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right text-gray-500 md:table-cell">
                      {p.stock_quantity ?? '∞'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
                      <Link
                        to={`/manager/products/${p.id}`}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        {t('actions.open', { ns: 'common' })}
                      </Link>
                      {isOwner && (
                        <Link
                          to={`/manager/products/${p.id}/edit`}
                          className="text-gray-600 hover:underline text-xs"
                        >
                          {t('actions.edit', { ns: 'common' })}
                        </Link>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setConfirmId(p.id);
                          }}
                          className="text-red-500 hover:underline text-xs"
                        >
                          {t('actions.delete', { ns: 'common' })}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalItems={filteredProducts.length}
            onPageChange={setPage}
            previousLabel={t('pagination.previous', { ns: 'common' })}
            nextLabel={t('pagination.next', { ns: 'common' })}
            pageLabel={(current, total) =>
              t('pagination.page', { ns: 'common', page: current, totalPages: total })
            }
          />
        </div>
      )}

      {/* Confirm delete modal */}
      {isOwner && confirmId && (
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
