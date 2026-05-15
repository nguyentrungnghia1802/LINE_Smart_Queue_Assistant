import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { del, get } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  stock_quantity: number | null;
  is_active: boolean;
}

function formatCurrency(n: string | number) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

export function ManagerProductsPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<ProductRow[]>({
    queryKey: ['products', orgId],
    queryFn: () => get<ProductRow[]>(`/api/v1/products?orgId=${orgId}`),
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/api/v1/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setConfirmId(null);
    },
  });

  if (isLoading) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sản phẩm / Dịch vụ</h1>
        <Link
          to="/manager/products/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + Thêm sản phẩm
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-400 text-sm">Chưa có sản phẩm nào.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium text-right">Giá</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Thời gian</th>
                <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Tồn kho</th>
                <th className="px-4 py-3 font-medium text-center">Thao tác</th>
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
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                    {p.service_time_minutes} phút
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
                        Chi tiết
                      </Link>
                      <Link
                        to={`/manager/products/${p.id}/edit`}
                        className="text-gray-600 hover:underline text-xs"
                      >
                        Sửa
                      </Link>
                      <button
                        onClick={() => setConfirmId(p.id)}
                        className="text-red-500 hover:underline text-xs"
                      >
                        Xoá
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
            <p className="text-sm text-gray-700 mb-4">Xác nhận xoá sản phẩm này?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Huỷ
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
