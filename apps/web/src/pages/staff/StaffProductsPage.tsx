import { useQuery } from '@tanstack/react-query';

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

function formatCurrency(n: string | number) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function StaffProductsPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products-staff', orgId],
    queryFn: () => get<Product[]>(`/api/v1/products?orgId=${orgId}`),
    enabled: !!orgId,
  });

  if (isLoading) {
    return <div className="text-gray-400 text-sm text-center py-12">読み込み中...</div>;
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">商品一覧</h1>
        <p className="mt-1 text-sm text-gray-500">受付で扱う商品・サービスを確認できます。</p>
      </div>

      {products.length === 0 && (
        <p className="text-gray-400 text-center py-12">商品がまだありません。</p>
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
                <span className="text-brand-700 font-bold">{formatCurrency(p.price)}</span>
                <span className="text-xs text-gray-400">{p.service_time_minutes} 分</span>
              </div>
              {p.requires_prepayment && (
                <span className="inline-block text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  事前支払いが必要
                </span>
              )}
              {p.stock_quantity !== null && (
                <p className="text-xs text-gray-400">残り: {p.stock_quantity}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
