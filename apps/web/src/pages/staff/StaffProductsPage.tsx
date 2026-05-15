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
  return Number(n).toLocaleString('vi-VN') + '₫';
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
    return <div className="text-gray-400 text-sm text-center py-12">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Danh sách sản phẩm</h1>

      {products.length === 0 && (
        <p className="text-gray-400 text-center py-12">Chưa có sản phẩm nào.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />
            ) : (
              <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-gray-300 text-4xl">
                🛒
              </div>
            )}
            <div className="p-4 space-y-1">
              <p className="font-semibold text-gray-800">{p.name}</p>
              {p.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-brand-700 font-bold">{formatCurrency(p.price)}</span>
                <span className="text-xs text-gray-400">{p.service_time_minutes} phút</span>
              </div>
              {p.requires_prepayment && (
                <span className="inline-block text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  Cần thanh toán trước
                </span>
              )}
              {p.stock_quantity !== null && (
                <p className="text-xs text-gray-400">Còn lại: {p.stock_quantity}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
