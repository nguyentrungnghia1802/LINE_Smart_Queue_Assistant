import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { formatCurrency } from '../../i18n/format';
import { get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface Product {
  id: string;
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

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products-staff', orgId],
    queryFn: () => get<Product[]>(`/api/v1/products?orgId=${orgId}`),
    enabled: !!orgId,
  });

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

      {products.length === 0 && (
        <p className="text-gray-400 text-center py-12">{t('products.empty')}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]"
          >
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center bg-gray-100 text-xl font-bold text-gray-400">
                {p.name.slice(0, 1)}
              </div>
            )}
            <div className="p-4 space-y-1">
              <p className="font-semibold text-gray-800">{p.name}</p>
              {p.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-brand-700 font-bold">
                  {formatCurrency(Number(p.price), i18n.resolvedLanguage ?? 'ja')}
                </span>
                <span className="text-xs text-gray-400">
                  {t('units.minutes', { ns: 'common', count: p.service_time_minutes })}
                </span>
              </div>
              {p.requires_prepayment && (
                <span className="inline-block text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {t('products.prepaymentRequired')}
                </span>
              )}
              {p.stock_quantity !== null && (
                <p className="text-xs text-gray-400">
                  {t('products.remaining', { count: p.stock_quantity })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
