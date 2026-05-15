import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

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
  is_active: boolean;
}

export function ManagerProductDetailPage() {
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

  if (isLoading || !product) return <div className="text-gray-400 text-sm">Đang tải...</div>;

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/manager/products" className="text-sm text-gray-500 hover:underline">
          ← Danh sách
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="w-32 h-32 rounded-lg object-cover" />
        )}
        <table className="text-sm w-full">
          <tbody className="divide-y divide-gray-100">
            {[
              ['Giá', Number(product.price).toLocaleString('vi-VN') + '₫'],
              ['Thời gian phục vụ', `${product.service_time_minutes} phút`],
              ['Chờ tối đa', product.max_wait_minutes ? `${product.max_wait_minutes} phút` : '—'],
              ['Thanh toán trước', product.requires_prepayment ? 'Có' : 'Không'],
              ['Tồn kho', product.stock_quantity !== null ? String(product.stock_quantity) : 'Không giới hạn'],
              ['Trạng thái', product.is_active ? 'Đang hoạt động' : 'Ẩn'],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="py-2 pr-4 text-gray-500 font-medium w-40">{label}</td>
                <td className="py-2 text-gray-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {product.description && (
          <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">{product.description}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            to={`/manager/products/${id}/edit`}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
          >
            Chỉnh sửa
          </Link>
          <button
            onClick={() => {
              if (confirm('Xác nhận xoá sản phẩm này?')) deleteMutation.mutate();
            }}
            className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}
