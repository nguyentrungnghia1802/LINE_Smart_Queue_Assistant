import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { formatCurrency } from '../../i18n/format';
import { del, get } from '../../services/apiClient';

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
}

export function ManagerProductDetailPage() {
  const { t, i18n } = useTranslation(['manager', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery<ProductRow>({
    queryKey: ['product', id],
    queryFn: () => get<ProductRow>(`/api/v1/products/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => del(`/api/v1/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/manager/products');
    },
  });

  if (isLoading || !product)
    return <div className="text-gray-400 text-sm">{t('states.loading', { ns: 'common' })}</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/manager/products"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            ← {t('products.title')}
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{product.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/manager/products/${id}/edit`}
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
          >
            {t('actions.edit', { ns: 'common' })}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[var(--shadow-soft)]">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-72 w-full object-cover" />
          ) : (
            <div className="flex h-72 w-full items-center justify-center bg-gray-100 text-4xl font-bold text-gray-400">
              {product.name.slice(0, 1)}
            </div>
          )}
        </div>
        <section className="rounded-2xl border border-white/80 bg-white p-6 shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {[
                [
                  t('products.type'),
                  product.product_type === 'service'
                    ? t('labels.service', { ns: 'common' })
                    : t('labels.product', { ns: 'common' }),
                ],
                [
                  t('labels.price', { ns: 'common' }),
                  formatCurrency(Number(product.price), i18n.resolvedLanguage ?? 'ja'),
                ],
                [
                  t('products.serviceTime'),
                  t('units.minutes', { ns: 'common', count: product.service_time_minutes }),
                ],
                [
                  t('products.maxWaitLabel'),
                  product.max_wait_minutes
                    ? t('units.minutes', { ns: 'common', count: product.max_wait_minutes })
                    : '—',
                ],
                [
                  t('products.prepayment'),
                  product.requires_prepayment ? t('products.yes') : t('products.no'),
                ],
                [
                  t('products.stock'),
                  product.stock_quantity !== null
                    ? String(product.stock_quantity)
                    : t('units.unlimited', { ns: 'common' }),
                ],
                [
                  t('labels.status', { ns: 'common' }),
                  product.is_active ? t('products.enabled') : t('products.hidden'),
                ],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="py-2 pr-4 text-gray-500 font-medium w-40">{label}</td>
                  <td className="py-2 text-gray-800">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.description && (
            <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">
              {product.description}
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                if (confirm(t('products.deleteConfirm'))) deleteMutation.mutate();
              }}
              className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100"
            >
              {t('actions.delete', { ns: 'common' })}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
