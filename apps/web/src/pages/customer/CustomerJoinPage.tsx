import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { get, post } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import {
  appendBookingRecord,
  type BookingGroup,
  cartSignature,
  type CheckoutItem,
  createCheckoutId,
  formatJPY,
  getLocalDeviceKey,
  loadBookingGroup,
  loadCheckoutDraft,
  loadPaidCheckout,
  type PaidCheckout,
  paymentKeyFor,
  saveCheckoutDraft,
  saveCheckoutSession,
} from '../../utils/checkoutSession';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  paymentInfo: string | null;
  latitude?: string | null;
  longitude?: string | null;
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

export function CustomerJoinPage() {
  const { orgSlug, token } = useParams<{ orgSlug?: string; token?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paidRequiredCheckout, setPaidRequiredCheckout] = useState<PaidCheckout | null>(null);
  const [paidFullCheckout, setPaidFullCheckout] = useState<PaidCheckout | null>(null);
  const [bookingGroup, setBookingGroup] = useState<BookingGroup | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const hydratedDraftKeyRef = useRef<string | null>(null);

  const apiEndpoint = token ? `/api/v1/orgs/by-token/${token}` : `/api/v1/orgs/${orgSlug}`;

  const { data, isLoading, isError } = useQuery<OrgResponse>({
    queryKey: ['org', orgSlug, token],
    queryFn: () => get<OrgResponse>(apiEndpoint),
    enabled: !!(orgSlug || token),
    staleTime: 30_000,
  });

  const draftKey = token ? `qr:${token}` : `q:${orgSlug ?? ''}`;

  const cartItems: CartItem[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [cart]
  );

  const checkoutItems = useMemo<CheckoutItem[]>(() => {
    if (!data) return [];
    return cartItems
      .map((item) => {
        const product = data.products.find((p) => p.id === item.productId);
        if (!product) return null;
        const unitPrice = Number(product.price);
        return {
          productId: product.id,
          name: product.name,
          imageUrl: product.image_url,
          quantity: item.quantity,
          unitPrice,
          subtotal: unitPrice * item.quantity,
          requiresPrepayment: product.requires_prepayment,
        };
      })
      .filter((item): item is CheckoutItem => item !== null);
  }, [cartItems, data]);

  const subtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.subtotal, 0),
    [checkoutItems]
  );
  const requiredPrepaymentItems = useMemo(
    () => checkoutItems.filter((item) => item.requiresPrepayment),
    [checkoutItems]
  );
  const requiredPrepaymentSubtotal = useMemo(
    () => requiredPrepaymentItems.reduce((sum, item) => sum + item.subtotal, 0),
    [requiredPrepaymentItems]
  );
  const currentCartSignature = useMemo(() => cartSignature(cartItems), [cartItems]);
  const paymentKeyBase = data ? `${data.org.slug}:${currentCartSignature}` : '';
  const requiredPaymentKey = paymentKeyBase ? paymentKeyFor(paymentKeyBase, 'required_items') : '';
  const fullPaymentKey = paymentKeyBase ? paymentKeyFor(paymentKeyBase, 'all_items') : '';
  const needsPrepayment = requiredPrepaymentItems.length > 0;
  const isRequiredPaid =
    needsPrepayment &&
    paidRequiredCheckout?.paid === true &&
    paidRequiredCheckout.cartSignature === currentCartSignature;
  const isFullyPaid =
    paidFullCheckout?.paid === true && paidFullCheckout.cartSignature === currentCartSignature;
  const canBook = !needsPrepayment || isRequiredPaid || isFullyPaid;

  function maxSelectable(product: Product): number {
    return product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
  }

  function stockViolation(items: CartItem[] = cartItems): string | null {
    if (!data) return null;
    for (const item of items) {
      const product = data.products.find((p) => p.id === item.productId);
      if (!product || product.stock_quantity === null) continue;
      if (product.stock_quantity <= 0) return `${product.name}は在庫切れです。`;
      if (item.quantity > product.stock_quantity) {
        return `${product.name}は在庫${product.stock_quantity}点まで選択できます。`;
      }
    }
    return null;
  }

  useEffect(() => {
    if (hydratedDraftKeyRef.current === draftKey) return;
    hydratedDraftKeyRef.current = draftKey;
    const draft = loadCheckoutDraft(draftKey);
    if (draft) {
      setCart(draft.cart);
      setCustomerName(draft.customerName);
      setCustomerPhone(draft.customerPhone);
    } else {
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
    }
    setPaidRequiredCheckout(null);
    setPaidFullCheckout(null);
    setBookingGroup(loadBookingGroup(draftKey));
  }, [draftKey]);

  useEffect(() => {
    if (hydratedDraftKeyRef.current !== draftKey) return;
    saveCheckoutDraft(draftKey, { cart, customerName, customerPhone });
  }, [cart, customerName, customerPhone, draftKey]);

  useEffect(() => {
    if (!currentCartSignature) {
      setPaidRequiredCheckout(null);
      setPaidFullCheckout(null);
      return;
    }
    setPaidRequiredCheckout(requiredPaymentKey ? loadPaidCheckout(requiredPaymentKey) : null);
    setPaidFullCheckout(fullPaymentKey ? loadPaidCheckout(fullPaymentKey) : null);
  }, [currentCartSignature, requiredPaymentKey, fullPaymentKey]);

  useEffect(() => {
    if (!data) return;
    setCart((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const product of data.products) {
        const current = next[product.id] ?? 0;
        const max = product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
        if (current > max) {
          next[product.id] = max;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  function setQty(product: Product, delta: number) {
    setCart((prev) => {
      const current = prev[product.id] ?? 0;
      const next = Math.max(0, Math.min(maxSelectable(product), current + delta));
      return { ...prev, [product.id]: next };
    });
  }

  function setQtyAbsolute(product: Product, quantity: number) {
    setCart((prev) => ({
      ...prev,
      [product.id]: Math.max(0, Math.min(maxSelectable(product), quantity)),
    }));
  }

  function startPayment() {
    if (!data || checkoutItems.length === 0 || !currentCartSignature) return;
    const stockError = stockViolation();
    if (stockError) {
      setError(stockError);
      return;
    }
    if (requiredPrepaymentItems.length === 0) return;
    const sessionId = createCheckoutId();
    saveCheckoutSession({
      id: sessionId,
      orgName: data.org.name,
      returnPath: location.pathname,
      cartSignature: currentCartSignature,
      paymentKey: requiredPaymentKey,
      paymentKeyBase,
      scope: 'required_items',
      items: checkoutItems,
      subtotal,
      coveredProductIds: requiredPrepaymentItems.map((item) => item.productId),
      requiredProductIds: requiredPrepaymentItems.map((item) => item.productId),
      requiredSubtotal: requiredPrepaymentSubtotal,
      createdAt: new Date().toISOString(),
    });
    navigate(`/checkout/demo/${sessionId}`);
  }

  function requestCustomerLocation() {
    if (!('geolocation' in navigator)) {
      setLocationStatus('位置情報を利用できません。');
      return;
    }
    setLocationStatus('現在地を取得中...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        });
        setLocationStatus('現在地を共有しました。');
      },
      () => setLocationStatus('現在地を取得できませんでした。'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cartItems.length === 0) {
      setError('商品またはサービスを1つ以上選択してください。');
      return;
    }
    if (!canBook) {
      setError('事前支払いが必要な商品があります。対象商品のお支払いを完了してください。');
      return;
    }
    const stockError = stockViolation();
    if (stockError) {
      setError(stockError);
      return;
    }
    const paidCheckout = isFullyPaid
      ? paidFullCheckout
      : isRequiredPaid
        ? paidRequiredCheckout
        : null;
    const localDeviceKey = getLocalDeviceKey();
    const bookingGroupId = bookingGroup?.id ?? createCheckoutId();
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
          bookingGroupId,
          localDeviceKey,
          customerLocation: customerLocation
            ? {
                latitude: customerLocation.latitude,
                longitude: customerLocation.longitude,
                accuracyMeters: customerLocation.accuracyMeters,
              }
            : undefined,
          paymentStatus: isFullyPaid ? 'paid' : 'unpaid',
          paymentCode: paidCheckout?.code,
          payment: paidCheckout
            ? {
                status: 'paid',
                provider: 'demo',
                method: paidCheckout.method,
                code: paidCheckout.code,
                amount: paidCheckout.amount,
                currency: 'JPY',
                scope: paidCheckout.scope,
                coveredProductIds: paidCheckout.coveredProductIds,
                rawPayload: { paidAt: paidCheckout.paidAt },
              }
            : undefined,
        }
      );
      const nextGroup = appendBookingRecord(
        draftKey,
        { orgSlug: data?.org.slug ?? '', token, localDeviceKey, groupId: bookingGroupId },
        {
          orderId: result.order.id,
          queueEntryId: result.queueEntry.id,
          ticketPath: `/ticket/${result.queueEntry.id}`,
          createdAt: new Date().toISOString(),
          items: checkoutItems,
          subtotal,
          paymentScope: paidCheckout?.scope,
          paymentCode: paidCheckout?.code,
        }
      );
      setBookingGroup(nextGroup);
      setCart({});
      setPaidRequiredCheckout(null);
      setPaidFullCheckout(null);
      navigate(`/ticket/${result.queueEntry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注文に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
        <p className="text-red-600">店舗が見つかりません。QRコードをもう一度読み取ってください。</p>
      </div>
    );
  }

  const { org, queue, products } = data;

  return (
    <div className="min-h-screen bg-[var(--app-bg)] pb-28">
      <header className="border-b border-white/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-700">
              {org.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              受付ページ
            </p>
            <h1 className="truncate text-xl font-bold text-gray-950">{org.name}</h1>
            {org.address && <p className="truncate text-sm text-gray-500">{org.address}</p>}
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => navigate('/customer')}
              className="ml-auto rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ダッシュボード
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {queue ? (
            <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">{queue.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">オンライン受付中</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Metric label="待ち人数" value={`${queue.waitingCount}`} />
                  <Metric label="目安" value={`${queue.avgWaitMinutes}分`} />
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              現在受付中のキューはありません。
            </section>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-950">商品 / サービス</h2>
                <p className="mt-1 text-sm text-gray-500">必要な項目を選択してください。</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                {products.length} 件
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] ?? 0}
                  onDecrease={() => setQty(product, -1)}
                  onIncrease={() => setQty(product, 1)}
                  onQuantityChange={(quantity) => setQtyAbsolute(product, quantity)}
                />
              ))}
            </div>
          </section>
        </div>

        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-4 rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-6"
        >
          {bookingGroup && bookingGroup.records.length > 0 && (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-emerald-950">予約済み</h2>
                  <p className="mt-1 text-xs text-emerald-800">同じ端末から追加予約できます。</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {bookingGroup.records.length} 件
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {bookingGroup.records.slice(0, 3).map((record) => (
                  <button
                    key={record.queueEntryId}
                    type="button"
                    onClick={() => navigate(record.ticketPath)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-xs text-gray-600 hover:bg-emerald-100/60"
                  >
                    <span>{new Date(record.createdAt).toLocaleString('ja-JP')}</span>
                    <span className="font-bold text-gray-950">{formatJPY(record.subtotal)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-950">受付内容</h2>
            <p className="mt-1 text-sm text-gray-500">選択内容とお客様情報を確認します。</p>
          </div>

          <div className="space-y-3">
            <TextInput
              label="お名前（任意）"
              value={customerName}
              onChange={setCustomerName}
              placeholder="例: 山田太郎"
            />
            <TextInput
              label="電話番号（任意）"
              type="tel"
              value={customerPhone}
              onChange={setCustomerPhone}
              placeholder="例: 0901234567"
            />
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            {checkoutItems.length === 0 ? (
              <p className="text-sm text-gray-500">まだ商品が選択されていません。</p>
            ) : (
              <div className="space-y-2">
                {checkoutItems.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.name} x {item.quantity}
                      </p>
                      {item.requiresPrepayment && (
                        <p className="mt-0.5 text-xs text-amber-700">事前支払い対象</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-950">
                      {formatJPY(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="text-sm font-medium text-gray-600">合計</span>
              <span className="text-xl font-bold text-gray-950">{formatJPY(subtotal)}</span>
            </div>
          </div>

          <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">現在地</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  順番が近い時の距離アラートに利用します。
                </p>
              </div>
              <button
                type="button"
                onClick={requestCustomerLocation}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                共有
              </button>
            </div>
            {locationStatus && <p className="mt-2 text-xs text-gray-500">{locationStatus}</p>}
          </section>

          {needsPrepayment && (
            <section className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-brand-900">お支払い</h3>
                  <p className="mt-1 text-xs leading-5 text-brand-800">
                    事前支払い対象の商品・サービスがあります。
                  </p>
                </div>
                {(isRequiredPaid || isFullyPaid) && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-700">
                    {isFullyPaid ? '全額支払い済み' : '必須分支払い済み'}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-3">
                {isFullyPaid || isRequiredPaid ? (
                  <p className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
                    決済番号: {(isFullyPaid ? paidFullCheckout : paidRequiredCheckout)?.code}
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startPayment}
                      disabled={checkoutItems.length === 0}
                      className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      事前支払いへ進む
                    </button>
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      予約する前に、事前支払い対象分のお支払いを完了してください。支払い画面で全額支払いも選択できます。
                    </p>
                  </>
                )}
              </div>
            </section>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !queue || cartItems.length === 0 || !canBook}
            className="w-full rounded-xl bg-gray-950 px-4 py-3 text-base font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? '予約中...' : canBook ? '予約する' : '必須支払い後に予約'}
          </button>
        </form>
      </main>
    </div>
  );
}

function ProductCard({
  product,
  quantity,
  onDecrease,
  onIncrease,
  onQuantityChange,
}: Readonly<{
  product: Product;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onQuantityChange: (quantity: number) => void;
}>) {
  const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
  const maxQuantity = product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
  const atMax = quantity >= maxQuantity;

  return (
    <article
      className={`group relative rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)] transition ${
        outOfStock ? 'opacity-70' : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]'
      }`}
    >
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className={`h-full w-full object-cover ${outOfStock ? 'grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-500">
              {product.name.slice(0, 1)}
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="rounded-full bg-gray-950 px-2.5 py-1 text-xs font-bold text-white">
                在庫なし
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-bold text-gray-950">{product.name}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
              {product.product_type === 'service' ? 'サービス' : '商品'}
            </span>
          </div>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
              {product.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-brand-700">{formatJPY(product.price)}</span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
              {product.service_time_minutes}分
            </span>
            {product.requires_prepayment && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                事前支払い
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {outOfStock
            ? '在庫なし'
            : product.stock_quantity === null
              ? '予約可能'
              : `在庫 ${product.stock_quantity}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrease}
            disabled={quantity === 0 || outOfStock}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            aria-label={`${product.name} を減らす`}
          >
            -
          </button>
          <input
            type="number"
            min={0}
            max={maxQuantity}
            value={quantity}
            disabled={outOfStock}
            onChange={(event) => onQuantityChange(Number(event.target.value))}
            className="h-9 w-14 rounded-full border border-gray-200 bg-white text-center text-sm font-bold text-gray-950 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-gray-100 disabled:text-gray-400"
            aria-label={`${product.name} の数量`}
          />
          <button
            type="button"
            onClick={onIncrease}
            disabled={outOfStock || atMax}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-40"
            aria-label={`${product.name} を追加`}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-20 rounded-xl bg-gray-50 px-4 py-3">
      <p className="text-xl font-bold text-gray-950">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    </label>
  );
}
