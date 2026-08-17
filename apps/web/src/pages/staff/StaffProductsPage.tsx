import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatCurrency } from '../../i18n/format';
import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface Product {
  id: string;
  product_code: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  max_wait_minutes: number | null;
  requires_prepayment: boolean;
  stock_quantity: number | null;
}

export function StaffProductsPage() {
  const { t, i18n } = useTranslation(['staff', 'common']);
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products-staff', orgId],
    queryFn: () => get<Product[]>(`/api/v1/products?orgId=${orgId}`),
    enabled: !!orgId,
  });
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter(
      (product) =>
        !query ||
        product.name.toLocaleLowerCase().includes(query) ||
        product.product_code.toLocaleLowerCase().includes(query)
    );
  }, [products, search]);

  if (isLoading) {
    return (
      <div className="text-gray-400 text-sm text-center py-12">
        {t('states.loading', { ns: 'common' })}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">{t('products.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('products.description')}</p>
      </div>
      <label className="flex max-w-xl items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{t('products.search')}</span>
        <input
          type="search"
          name="staffProductSearch"
          maxLength={160}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('products.searchPlaceholder')}
          className="min-w-0 flex-1 border-0 py-2.5 text-sm outline-none"
        />
      </label>

      {visibleProducts.length === 0 && (
        <p className="text-gray-400 text-center py-12">{t('products.empty')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {visibleProducts.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setSelectedProduct(p)}
            className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <div className="aspect-square w-full shrink-0 overflow-hidden bg-gray-100">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-400">
                  {p.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="grid min-h-40 w-full min-w-0 flex-1 grid-rows-[1rem_1.25rem_1.25rem_1.5rem_1.25rem_1rem] gap-1 p-3">
              <p
                className="truncate font-mono text-[11px] font-bold text-brand-700"
                title={p.product_code}
              >
                {p.product_code}
              </p>
              <p className="truncate text-sm font-semibold text-gray-800" title={p.name}>
                {p.name}
              </p>
              <p className="truncate text-xs text-gray-500" title={p.description ?? undefined}>
                {p.description}
              </p>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-1">
                <span
                  className="truncate text-xs font-bold text-brand-700 sm:text-sm"
                  title={formatCurrency(Number(p.price), i18n.resolvedLanguage ?? 'ja')}
                >
                  {formatCurrency(Number(p.price), i18n.resolvedLanguage ?? 'ja')}
                </span>
                <span
                  className="max-w-16 truncate text-xs text-gray-400"
                  title={t('units.minutes', {
                    ns: 'common',
                    count: p.service_time_minutes,
                  })}
                >
                  {t('units.minutes', {
                    ns: 'common',
                    count: p.service_time_minutes,
                  })}
                </span>
              </div>
              <div className="min-w-0 overflow-hidden">
                {p.requires_prepayment && (
                  <span
                    className="inline-block max-w-full truncate rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700"
                    title={t('products.prepaymentRequired')}
                  >
                    {t('products.prepaymentRequired')}
                  </span>
                )}
              </div>
              <p
                className="truncate text-xs text-gray-400"
                title={
                  p.stock_quantity === null
                    ? undefined
                    : t('products.remaining', { count: p.stock_quantity })
                }
              >
                {p.stock_quantity !== null && t('products.remaining', { count: p.stock_quantity })}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-product-detail-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
        >
          <article className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label={t('actions.close', { ns: 'common' })}
              className="absolute right-3 top-3 z-10 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-white bg-gray-950 px-3.5 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
            >
              <X className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
              <span>{t('actions.close', { ns: 'common' })}</span>
            </button>
            {selectedProduct.image_url ? (
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.name}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 text-5xl font-bold text-gray-400">
                {selectedProduct.name.slice(0, 1)}
              </div>
            )}
            <p className="mt-5 font-mono text-xs font-bold text-brand-700">
              {selectedProduct.product_code}
            </p>
            <h2 id="staff-product-detail-title" className="mt-1 pr-10 text-2xl font-bold">
              {selectedProduct.name}
            </h2>
            {selectedProduct.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {selectedProduct.description}
              </p>
            )}
            <dl className="mt-5 grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <ProductDetail
                label={t('products.price')}
                value={formatCurrency(Number(selectedProduct.price), i18n.resolvedLanguage ?? 'ja')}
              />
              <ProductDetail
                label={t('products.serviceTime')}
                value={t('units.minutes', {
                  ns: 'common',
                  count: selectedProduct.service_time_minutes,
                })}
              />
              <ProductDetail
                label={t('products.stock')}
                value={
                  selectedProduct.stock_quantity === null
                    ? t('products.unlimited')
                    : String(selectedProduct.stock_quantity)
                }
              />
              <ProductDetail
                label={t('products.paymentRule')}
                value={
                  selectedProduct.requires_prepayment
                    ? t('products.prepaymentRequired')
                    : t('products.payAtCounter')
                }
              />
            </dl>
          </article>
        </div>
      )}
    </div>
  );
}

function ProductDetail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 font-bold text-gray-900">{value}</dd>
    </div>
  );
}
