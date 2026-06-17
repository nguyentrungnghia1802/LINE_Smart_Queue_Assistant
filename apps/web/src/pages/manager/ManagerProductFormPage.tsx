import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { get, patch, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';

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
};

export function ManagerProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const orgId = user?.organizationId;
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  const { data: existing } = useQuery<ProductRow>({
    queryKey: ['product', id],
    queryFn: () => get<ProductRow>(`/api/v1/products/${id}`),
    enabled: isEdit,
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
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) =>
      isEdit
        ? patch(`/api/v1/products/${id}`, dto)
        : post(`/api/v1/products`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', orgId] });
      navigate('/manager/products');
    },
    onError: () => setError('Có lỗi xảy ra. Vui lòng thử lại.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate({
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      price: parseFloat(form.price),
      serviceTimeMinutes: parseInt(form.serviceTimeMinutes),
      maxWaitMinutes: form.maxWaitMinutes ? parseInt(form.maxWaitMinutes) : undefined,
      requiresPrepayment: form.requiresPrepayment,
      stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity) : undefined,
      productType: form.productType,
    });
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
        {isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {field('Tên sản phẩm *', (
          <input className={inputCls} required value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        ))}
        {field('Loại *', (
          <select
            className={inputCls}
            value={form.productType}
            onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value as 'product' | 'service' }))}
          >
            <option value="service">Dịch vụ (Service)</option>
            <option value="product">Sản phẩm (Product)</option>
          </select>
        ))}
        {field('Mô tả', (
          <textarea className={inputCls} rows={3} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        ))}
        {field('URL ảnh', (
          <input className={inputCls} type="url" value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} />
        ))}
        {field('Giá (₫) *', (
          <input className={inputCls} type="number" min={0} required value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
        ))}
        {field('Thời gian phục vụ (phút) *', (
          <input className={inputCls} type="number" min={1} required value={form.serviceTimeMinutes}
            onChange={(e) => setForm((f) => ({ ...f, serviceTimeMinutes: e.target.value }))} />
        ))}
        {field('Thời gian chờ tối đa (phút)', (
          <input className={inputCls} type="number" min={1} value={form.maxWaitMinutes}
            onChange={(e) => setForm((f) => ({ ...f, maxWaitMinutes: e.target.value }))} />
        ))}
        {field('Tồn kho (để trống = không giới hạn)', (
          <input className={inputCls} type="number" min={0} value={form.stockQuantity}
            onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))} />
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.requiresPrepayment}
            onChange={(e) => setForm((f) => ({ ...f, requiresPrepayment: e.target.checked }))} />
          Yêu cầu thanh toán trước
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/manager/products')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
}
