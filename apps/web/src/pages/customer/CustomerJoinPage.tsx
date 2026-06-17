import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { get, post } from '../../services/apiClient';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  paymentInfo: string | null;
}

interface QueueInfo {
  id: string;
  name: string;
  prefix: string;
  waitingCount: number;
  avgWaitMinutes: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  service_time_minutes: number;
  requires_prepayment: boolean;
  stock_quantity: number | null;
  product_type: 'product' | 'service';
}

interface OrgResponse {
  org: OrgInfo;
  queue: QueueInfo | null;
  products: Product[];
}

interface CartItem {
  productId: string;
  quantity: number;
}

function formatCurrency(n: string | number) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

export function CustomerJoinPage() {
  const { orgSlug, token } = useParams<{ orgSlug?: string; token?: string }>();
  const navigate = useNavigate();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine API endpoint based on route
  const apiEndpoint = token ? `/api/v1/orgs/by-token/${token}` : `/api/v1/orgs/${orgSlug}`;

  const { data, isLoading, isError } = useQuery<OrgResponse>({
    queryKey: ['org', orgSlug, token],
    queryFn: () => get<OrgResponse>(apiEndpoint),
    enabled: !!(orgSlug || token),
    staleTime: 30_000,
  });

  // Reset cart when org changes
  useEffect(() => {
    setCart({});
  }, [orgSlug, token]);

  const cartItems: CartItem[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [cart]
  );

  const subtotal = useMemo(() => {
    if (!data) return 0;
    return cartItems.reduce((acc, item) => {
      const p = data.products.find((p) => p.id === item.productId);
      return acc + Number(p?.price ?? 0) * item.quantity;
    }, 0);
  }, [cartItems, data]);

  const needsPrepayment = useMemo(() => {
    if (!data) return false;
    return cartItems.some((item) => {
      const p = data.products.find((p) => p.id === item.productId);
      return p?.requires_prepayment;
    });
  }, [cartItems, data]);

  function setQty(productId: string, delta: number) {
    setCart((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) {
      setError('Vui lòng chọn ít nhất một sản phẩm.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await post<{ order: { id: string }; queueEntry: { id: string } }>(
        '/api/v1/orders',
        {
          orgSlug: data?.org.slug,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: cartItems,
        }
      );
      navigate(`/ticket/${result.queueEntry.id}`);
    } catch {
      setError('Đặt hàng thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">Không tìm thấy cửa hàng. Vui lòng quét lại QR.</p>
      </div>
    );
  }

  const { org, queue, products } = data;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl">
              {org.name[0]}
            </div>
          )}
          <div>
            <h1 className="font-bold text-gray-900">{org.name}</h1>
            {org.address && <p className="text-xs text-gray-500">{org.address}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 space-y-5 pt-5">
        {/* Queue info card */}
        {queue ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-brand-600">{queue.waitingCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">người đang đợi</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-700">{queue.avgWaitMinutes}</p>
              <p className="text-xs text-gray-500 mt-0.5">phút chờ ước tính</p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-700 text-sm">
            Hiện tại không có hàng đợi nào đang mở.
          </div>
        )}

        {/* Product list */}
        {products.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Chọn sản phẩm / dịch vụ</h2>
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl shrink-0">
                    🛒
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-brand-700 font-bold text-sm">{formatCurrency(p.price)}</span>
                    <span className="text-xs text-gray-400">· {p.service_time_minutes} phút</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.product_type === 'service' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.product_type === 'service' ? 'Dịch vụ' : 'Sản phẩm'}
                    </span>
                    {p.requires_prepayment && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        Cần đặt cọc
                      </span>
                    )}
                  </div>
                </div>
                {/* Quantity control */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQty(p.id, -1)}
                    disabled={(cart[p.id] ?? 0) === 0}
                    className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center font-bold transition-colors"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-gray-800">
                    {cart[p.id] ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(p.id, 1)}
                    className="w-8 h-8 rounded-full border border-brand-500 text-brand-600 hover:bg-brand-50 flex items-center justify-center font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên của bạn (tuỳ chọn)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Số điện thoại (tuỳ chọn)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ví dụ: 0901234567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Total */}
          {subtotal > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Tổng cộng</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
          )}

          {/* Payment info */}
          {needsPrepayment && org.paymentInfo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-yellow-800">Thông tin thanh toán trước</p>
              <p className="text-sm text-yellow-700 whitespace-pre-line">{org.paymentInfo}</p>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !queue}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-base transition-colors"
          >
            {submitting ? 'Đang đặt chỗ...' : 'Lấy số thứ tự'}
          </button>
        </form>
      </div>
    </div>
  );
}
