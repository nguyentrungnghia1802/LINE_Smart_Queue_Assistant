import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { UserRole } from '@line-queue/shared';

import { BrandLogo } from '../../components/BrandLogo';
import { LanguageSwitcher } from '../../components/i18n/LanguageSwitcher';
import { StandalonePageTopBar } from '../../components/layout/StandalonePageTopBar';
import { useLiffRuntime } from '../../contexts/LiffRuntimeContext';
import { useMyTickets } from '../../hooks/useQueueEntry';
import { formatDateTime } from '../../i18n/format';
import { ApiClientError, get, post, put } from '../../services/apiClient';
import { getCustomerLineEntryUrl } from '../../services/liff/entryUrl';
import { useAuthStore } from '../../store/authStore';
import type { LiffAuthStatus } from '../../types/liff';
import { formatAddress } from '../../utils/address';
import {
  appendBookingRecord,
  type BookingGroup,
  cartSignature,
  type CheckoutItem,
  clearCheckoutDraft,
  clearPaidCheckout,
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
  savePaidCheckout,
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
  defaultLocale?: 'ja' | 'vi' | 'en';
}

interface QueueInfo {
  id: string;
  name: string;
  description: string | null;
  prefix: string;
  status: 'open' | 'paused' | 'closed';
  isAcceptingBookings: boolean;
  isQueueOpen: boolean;
  isBranchOpen: boolean;
  waitingCount: number;
  avgWaitMinutes: number;
  products: Product[];
}

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
  product_type: 'product' | 'service';
}

interface OrgResponse {
  org: OrgInfo;
  branch: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
    addressLine2: string | null;
    latitude: string | null;
    longitude: string | null;
    googlePlaceId: string | null;
    formattedMapAddress: string | null;
    currencyCode: 'JPY' | 'VND';
    collectionProvider: 'payos' | 'manual';
    isOpen: boolean;
  };
  queues: QueueInfo[];
  queue: QueueInfo | null;
  products: Product[];
}

interface CartItem {
  productId: string;
  quantity: number;
}

interface CustomerJoinPageProps {
  mode?: 'public' | 'liff';
  liffAuthStatus?: LiffAuthStatus;
  liffAuthError?: Error | null;
}

function dashboardPathForRole(role: UserRole | undefined): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.MANAGER:
      return '/manager';
    case UserRole.STAFF:
      return '/staff';
    case UserRole.CUSTOMER:
      return '/liff/home';
    default:
      return '/';
  }
}

function queueAvailabilityKey(
  queue: QueueInfo | null | undefined,
  queueCount: number
):
  | 'booking.noQueuesConfigured'
  | 'booking.branchClosed'
  | 'booking.queuePaused'
  | 'booking.queueClosed' {
  if (queueCount === 0) return 'booking.noQueuesConfigured';
  if (!queue) return 'booking.queueClosed';
  if (!queue.isQueueOpen) return 'booking.queuePaused';
  if (!queue.isBranchOpen) return 'booking.branchClosed';
  return 'booking.queueClosed';
}

export function LiffCustomerJoinPage() {
  const liff = useLiffRuntime();
  return (
    <CustomerJoinPage mode="liff" liffAuthStatus={liff.authStatus} liffAuthError={liff.authError} />
  );
}

export function CustomerLineEntryPage() {
  const { orgSlug, token } = useParams<{ orgSlug?: string; token?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const customerLineEntryUrl = token
    ? getCustomerLineEntryUrl(`/liff/qr/${token}`)
    : orgSlug
      ? getCustomerLineEntryUrl(`/liff/q/${orgSlug}`)
      : null;
  const isBusinessAccount = isAuthenticated && user?.role !== UserRole.CUSTOMER;

  useEffect(() => {
    if (isBusinessAccount || !customerLineEntryUrl) return;
    if (customerLineEntryUrl.startsWith('/')) {
      navigate(customerLineEntryUrl, { replace: true });
      return;
    }
    window.location.replace(customerLineEntryUrl);
  }, [customerLineEntryUrl, isBusinessAccount, navigate]);

  if (isBusinessAccount) {
    return (
      <CustomerAccountRequiredPage
        customerLineEntryUrl={customerLineEntryUrl}
        dashboardPath={dashboardPathForRole(user?.role)}
      />
    );
  }

  return <CustomerLineRedirectState isConfigured={Boolean(customerLineEntryUrl)} />;
}

export function CustomerJoinPage({
  mode = 'public',
  liffAuthStatus = 'guest',
  liffAuthError = null,
}: Readonly<CustomerJoinPageProps>) {
  const { t, i18n } = useTranslation(['customer', 'common']);
  const { orgSlug, token } = useParams<{ orgSlug?: string; token?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const isLiffMode = mode === 'liff';
  const isLineAuthenticated = !isLiffMode || liffAuthStatus === 'authenticated';
  const isBusinessAccount =
    isAuthenticated &&
    user?.role !== UserRole.CUSTOMER &&
    (!isLiffMode || liffAuthStatus === 'authenticated');
  const customerLineEntryUrl = token
    ? getCustomerLineEntryUrl(`/liff/qr/${token}`)
    : orgSlug
      ? getCustomerLineEntryUrl(`/liff/q/${orgSlug}`)
      : null;

  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedQueueId, setSelectedQueueId] = useState('');
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const bookingCompletedRef = useRef(false);
  const bookingAttemptIdRef = useRef(createCheckoutId());
  const autoBookingTransactionRef = useRef<string | null>(null);

  const apiEndpoint = token ? `/api/v1/orgs/by-token/${token}` : `/api/v1/orgs/${orgSlug}`;

  const { data, isLoading, isError } = useQuery<OrgResponse>({
    queryKey: ['org', orgSlug, token],
    queryFn: () => get<OrgResponse>(apiEndpoint),
    enabled: !!(orgSlug || token),
    staleTime: 30_000,
  });
  const { data: activeTickets } = useMyTickets({
    enabled: isLineAuthenticated && isAuthenticated && user?.role === UserRole.CUSTOMER,
  });
  const activeBookingRecords = useMemo(() => {
    if (!bookingGroup || !activeTickets) return [];
    const activeEntryIds = new Set(activeTickets.map((ticket) => ticket.entry.id));
    return bookingGroup.records.filter((record) => activeEntryIds.has(record.queueEntryId));
  }, [activeTickets, bookingGroup]);
  const selectedQueue = useMemo(
    () => data?.queues.find((queue) => queue.id === selectedQueueId) ?? null,
    [data?.queues, selectedQueueId]
  );
  const products = useMemo(() => selectedQueue?.products ?? [], [selectedQueue]);
  const availabilityMessage = t(queueAvailabilityKey(selectedQueue, data?.queues.length ?? 0), {
    ns: 'customer',
  });

  useEffect(() => {
    if (
      !user?.preferredLocale &&
      data?.org.defaultLocale &&
      i18n.resolvedLanguage !== data.org.defaultLocale
    ) {
      void i18n.changeLanguage(data.org.defaultLocale);
    }
  }, [data?.org.defaultLocale, i18n, user?.preferredLocale]);

  const draftKeyPrefix = isLiffMode ? 'liff' : 'public';
  const draftKey = token ? `${draftKeyPrefix}:qr:${token}` : `${draftKeyPrefix}:q:${orgSlug ?? ''}`;

  const cartItems: CartItem[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [cart]
  );

  const checkoutItems = useMemo<CheckoutItem[]>(() => {
    return cartItems
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
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
  }, [cartItems, products]);

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
  const paymentKeyBase =
    data && selectedQueue ? `${data.org.slug}:${selectedQueue.id}:${currentCartSignature}` : '';
  const requiredPaymentKey = paymentKeyBase ? paymentKeyFor(paymentKeyBase, 'required_items') : '';
  const fullPaymentKey = paymentKeyBase ? paymentKeyFor(paymentKeyBase, 'all_items') : '';
  const needsPrepayment = requiredPrepaymentItems.length > 0;
  const isRequiredPaid =
    needsPrepayment &&
    paidRequiredCheckout?.paid === true &&
    Boolean(paidRequiredCheckout.transactionId) &&
    paidRequiredCheckout.cartSignature === currentCartSignature;
  const isFullyPaid =
    paidFullCheckout?.paid === true &&
    Boolean(paidFullCheckout.transactionId) &&
    paidFullCheckout.cartSignature === currentCartSignature;
  const canBook = !needsPrepayment || isRequiredPaid || isFullyPaid;

  function customerDetailsError(): string | null {
    if (!customerName.trim()) return t('booking.nameRequired', { ns: 'customer' });
    if (!customerPhone.trim()) return t('booking.phoneRequired', { ns: 'customer' });
    const normalizedPhone = customerPhone.replace(/[\s()-]/g, '');
    if (!/^(?:\+81|0)\d{9,10}$/.test(normalizedPhone)) {
      return t('booking.phoneInvalid', { ns: 'customer' });
    }
    return null;
  }

  function maxSelectable(product: Product): number {
    return product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
  }

  function stockViolation(items: CartItem[] = cartItems): string | null {
    if (!data) return null;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock_quantity === null) continue;
      if (product.stock_quantity <= 0)
        return t('booking.stockUnavailable', { ns: 'customer', name: product.name });
      if (item.quantity > product.stock_quantity) {
        return t('booking.stockLimit', {
          ns: 'customer',
          name: product.name,
          count: product.stock_quantity,
        });
      }
    }
    return null;
  }

  useEffect(() => {
    if (hydratedDraftKeyRef.current === draftKey) return;
    hydratedDraftKeyRef.current = draftKey;
    bookingCompletedRef.current = false;
    const draft = loadCheckoutDraft(draftKey);
    if (draft) {
      setCart(draft.cart);
      setCustomerName(draft.customerName);
      setCustomerPhone(draft.customerPhone);
      setSelectedQueueId(draft.selectedQueueId ?? '');
    } else {
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setSelectedQueueId('');
    }
    setPaidRequiredCheckout(null);
    setPaidFullCheckout(null);
    setBookingGroup(loadBookingGroup(draftKey));
  }, [draftKey]);

  useEffect(() => {
    if (hydratedDraftKeyRef.current !== draftKey) return;
    if (bookingCompletedRef.current) return;
    saveCheckoutDraft(draftKey, { cart, customerName, customerPhone, selectedQueueId });
  }, [cart, customerName, customerPhone, draftKey, selectedQueueId]);

  useEffect(() => {
    if (!data || selectedQueueId) return;
    if (data.queues.length === 1) setSelectedQueueId(data.queues[0].id);
  }, [data, selectedQueueId]);

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
    if (!selectedQueue) return;
    setCart((prev) => {
      let changed = false;
      const next = { ...prev };
      const availableIds = new Set(products.map((product) => product.id));
      for (const productId of Object.keys(next)) {
        if (!availableIds.has(productId) && next[productId] !== 0) {
          next[productId] = 0;
          changed = true;
        }
      }
      for (const product of products) {
        const current = next[product.id] ?? 0;
        const max = product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
        if (current > max) {
          next[product.id] = max;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [products, selectedQueue]);

  function selectQueue(queueId: string) {
    if (queueId === selectedQueueId) return;
    setSelectedQueueId(queueId);
    setCart({});
    setPaidRequiredCheckout(null);
    setPaidFullCheckout(null);
    setError('');
  }

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
    if (!selectedQueue?.isAcceptingBookings) {
      setError(availabilityMessage);
      return;
    }
    if (!isLineAuthenticated) {
      setError(t('booking.lineBeforePayment', { ns: 'customer' }));
      return;
    }
    const stockError = stockViolation();
    if (stockError) {
      setError(stockError);
      return;
    }
    const detailsError = customerDetailsError();
    if (detailsError) {
      setError(detailsError);
      return;
    }
    if (requiredPrepaymentItems.length === 0) return;
    saveCheckoutDraft(draftKey, { cart, customerName, customerPhone, selectedQueueId });
    const sessionId = createCheckoutId();
    saveCheckoutSession({
      id: sessionId,
      orgSlug: data.org.slug,
      orgName: data.branch.name,
      branchId: data.branch.id,
      queueId: selectedQueue.id,
      returnPath: location.pathname,
      cartSignature: currentCartSignature,
      paymentKey: requiredPaymentKey,
      paymentKeyBase,
      scope: 'required_items',
      items: checkoutItems,
      subtotal,
      currency: data.branch.currencyCode,
      coveredProductIds: requiredPrepaymentItems.map((item) => item.productId),
      requiredProductIds: requiredPrepaymentItems.map((item) => item.productId),
      requiredSubtotal: requiredPrepaymentSubtotal,
      autoBookAfterPayment: true,
      createdAt: new Date().toISOString(),
    });
    navigate(`${isLiffMode ? '/liff' : ''}/checkout/demo/${sessionId}`);
  }

  async function requestCustomerLocation() {
    if (!isLiffMode) {
      setLocationStatus(t('booking.lineRequiredForLocation', { ns: 'customer' }));
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocationStatus(t('booking.locationUnavailable', { ns: 'customer' }));
      return;
    }
    try {
      await put('/api/v1/line/location-consent', { enabled: true });
    } catch {
      setLocationStatus(t('booking.locationConsentFailed', { ns: 'customer' }));
      return;
    }
    setLocationStatus(t('booking.locationLoading', { ns: 'customer' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy),
        });
        setLocationStatus(t('booking.locationShared', { ns: 'customer' }));
      },
      () => setLocationStatus(t('booking.locationFailed', { ns: 'customer' })),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function submitBooking(paidCheckoutOverride?: PaidCheckout) {
    if (!selectedQueue?.isAcceptingBookings) {
      setError(availabilityMessage);
      return;
    }
    if (cartItems.length === 0) {
      setError(t('booking.selectItem', { ns: 'customer' }));
      return;
    }
    const detailsError = customerDetailsError();
    if (detailsError) {
      setError(detailsError);
      return;
    }
    if (!canBook && !paidCheckoutOverride) {
      setError(t('booking.prepaymentRequired', { ns: 'customer' }));
      return;
    }
    if (!isLineAuthenticated) {
      setError(t('booking.lineBeforeBooking', { ns: 'customer' }));
      return;
    }
    const stockError = stockViolation();
    if (stockError) {
      setError(stockError);
      return;
    }
    const paidCheckout =
      paidCheckoutOverride ??
      (isFullyPaid ? paidFullCheckout : isRequiredPaid ? paidRequiredCheckout : null);
    const localDeviceKey = getLocalDeviceKey();
    const bookingGroupId = bookingGroup?.id ?? createCheckoutId();
    setError('');
    setSubmitting(true);
    try {
      const result = await post<{
        order: { id: string; booking_group_id?: string | null; subtotal?: string };
        queueEntry: { id: string };
      }>(
        '/api/v1/orders',
        {
          orgSlug: data?.org.slug,
          branchId: data?.branch.id,
          queueId: selectedQueue.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
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
          payment: paidCheckout ? { transactionId: paidCheckout.transactionId } : undefined,
        },
        {
          headers: {
            'Idempotency-Key': `booking:${bookingAttemptIdRef.current}`,
          },
        }
      );
      const nextGroup = appendBookingRecord(
        draftKey,
        {
          orgSlug: data?.org.slug ?? '',
          token,
          localDeviceKey,
          groupId: result.order.booking_group_id ?? bookingGroupId,
        },
        {
          orderId: result.order.id,
          queueEntryId: result.queueEntry.id,
          ticketPath: `${isLiffMode ? '/liff' : ''}/ticket${isLiffMode ? 's' : ''}/${result.queueEntry.id}`,
          createdAt: new Date().toISOString(),
          items: checkoutItems,
          subtotal: Number(result.order.subtotal ?? subtotal),
          paymentScope: paidCheckout?.scope,
          paymentCode: paidCheckout?.code,
        }
      );
      setBookingGroup(nextGroup);
      bookingCompletedRef.current = true;
      clearCheckoutDraft(draftKey);
      if (requiredPaymentKey) clearPaidCheckout(requiredPaymentKey);
      if (fullPaymentKey) clearPaidCheckout(fullPaymentKey);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setCustomerLocation(null);
      setLocationStatus('');
      setPaidRequiredCheckout(null);
      setPaidFullCheckout(null);
      navigate(`${isLiffMode ? '/liff/tickets' : '/ticket'}/${result.queueEntry.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PAYMENT_ALREADY_USED') {
        if (requiredPaymentKey) clearPaidCheckout(requiredPaymentKey);
        if (fullPaymentKey) clearPaidCheckout(fullPaymentKey);
        setPaidRequiredCheckout(null);
        setPaidFullCheckout(null);
        bookingAttemptIdRef.current = createCheckoutId();
        setError(t('errors.PAYMENT_ALREADY_USED', { ns: 'common' }));
      } else {
        setError(
          err instanceof ApiClientError && err.code === 'QUEUE_NOT_ACCEPTING'
            ? t('errors.QUEUE_NOT_ACCEPTING', { ns: 'common' })
            : err instanceof Error
              ? err.message
              : t('booking.orderFailed', { ns: 'customer' })
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const detailsError = customerDetailsError();
    if (detailsError) {
      setError(detailsError);
      return;
    }
    if (needsPrepayment && !canBook) {
      startPayment();
      return;
    }
    void submitBooking();
  }

  useEffect(() => {
    const paidCheckout = isFullyPaid
      ? paidFullCheckout
      : isRequiredPaid
        ? paidRequiredCheckout
        : null;
    if (
      !paidCheckout?.autoBookAfterPayment ||
      submitting ||
      autoBookingTransactionRef.current === paidCheckout.transactionId
    ) {
      return;
    }

    autoBookingTransactionRef.current = paidCheckout.transactionId;
    const consumedCheckout = { ...paidCheckout, autoBookAfterPayment: false };
    const paymentKey = paidCheckout.scope === 'all_items' ? fullPaymentKey : requiredPaymentKey;
    if (paymentKey) savePaidCheckout(paymentKey, consumedCheckout);
    if (paidCheckout.scope === 'all_items') {
      setPaidFullCheckout(consumedCheckout);
    } else {
      setPaidRequiredCheckout(consumedCheckout);
    }
    void submitBooking(consumedCheckout);
    // submitBooking intentionally uses the checkout state captured by this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fullPaymentKey,
    isFullyPaid,
    isRequiredPaid,
    paidFullCheckout,
    paidRequiredCheckout,
    requiredPaymentKey,
    submitting,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)]">
        {!isLiffMode && <StandalonePageTopBar />}
        <div className="flex items-center justify-center px-4 py-16">
          <p className="text-gray-500">{t('states.loading', { ns: 'common' })}</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)]">
        {!isLiffMode && <StandalonePageTopBar />}
        <div className="flex items-center justify-center px-4 py-16">
          <p className="text-red-600">{t('booking.storeNotFound', { ns: 'customer' })}</p>
        </div>
      </div>
    );
  }

  const { org } = data;
  const branchAddress = formatAddress(
    {
      postalCode: data.branch.postalCode,
      prefecture: data.branch.prefecture,
      city: data.branch.city,
      addressLine1: data.branch.addressLine1,
      addressLine2: data.branch.addressLine2,
    },
    i18n.resolvedLanguage
  );

  if (isBusinessAccount) {
    return (
      <CustomerAccountRequiredPage
        customerLineEntryUrl={customerLineEntryUrl}
        dashboardPath={dashboardPathForRole(user?.role)}
      />
    );
  }

  return (
    <div
      className={
        isLiffMode ? 'min-h-full bg-[var(--app-bg)] pb-4' : 'min-h-screen bg-[var(--app-bg)] pb-28'
      }
    >
      {!isLiffMode && (
        <header className="border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
          <div className="mx-auto flex min-h-18 max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo decorative className="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950 sm:text-base">
                  {t('brandName', { ns: 'common' })}
                </p>
                <p className="truncate text-xs font-medium text-brand-700">
                  {t('booking.receptionPage', { ns: 'customer' })}
                </p>
              </div>
            </div>
            <div className="hidden h-8 w-px shrink-0 bg-gray-200 md:block" aria-hidden="true" />
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">
                  {org.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold text-gray-900">{data.branch.name}</h1>
                <p className="truncate text-xs text-gray-500">{branchAddress}</p>
              </div>
            </div>
            {isLiffMode ? (
              <button
                type="button"
                onClick={() => navigate('/liff/home')}
                className="ml-auto rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {t('nav.home', { ns: 'common' })}
              </button>
            ) : (
              isAuthenticated && (
                <button
                  type="button"
                  onClick={() => navigate(dashboardPathForRole(user?.role))}
                  className="ml-auto rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {t('nav.dashboard', { ns: 'common' })}
                </button>
              )
            )}
            {!isLiffMode && (
              <div className={isAuthenticated ? undefined : 'ml-auto'}>
                <LanguageSwitcher compact />
              </div>
            )}
          </div>
        </header>
      )}

      <main
        className={`mx-auto grid max-w-6xl gap-5 py-3 sm:py-5 lg:grid-cols-[minmax(0,1fr)_360px] ${
          isLiffMode ? 'px-0' : 'px-4'
        }`}
      >
        {isLiffMode && (
          <section className="flex min-w-0 items-center gap-3 rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm lg:col-span-2">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">
                {org.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-gray-950">{data.branch.name}</h1>
              <p className="truncate text-xs text-gray-500">{branchAddress}</p>
            </div>
          </section>
        )}

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
            <label className="block">
              <span className="text-lg font-bold text-gray-950">
                {t('booking.selectQueue', { ns: 'customer' })}
              </span>
              {data.queues.length > 0 && (
                <select
                  value={selectedQueueId}
                  onChange={(event) => selectQueue(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-950 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="" disabled>
                    {t('booking.selectQueuePlaceholder', { ns: 'customer' })}
                  </option>
                  {data.queues.map((queueOption) => (
                    <option key={queueOption.id} value={queueOption.id}>
                      {queueOption.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {data.queues.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                {t('booking.noQueuesConfigured', { ns: 'customer' })}
              </p>
            )}
          </section>

          {selectedQueue?.isAcceptingBookings ? (
            <section className="rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">{selectedQueue.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('booking.online', { ns: 'customer' })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Metric
                    label={t('labels.peopleAhead', { ns: 'common' })}
                    value={`${selectedQueue.waitingCount}`}
                  />
                  <Metric
                    label={t('labels.estimatedWait', { ns: 'common' })}
                    value={t('units.minutes', {
                      ns: 'common',
                      count: selectedQueue.avgWaitMinutes,
                    })}
                  />
                </div>
              </div>
            </section>
          ) : selectedQueue ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              {availabilityMessage}
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-950">
                  {t('booking.productsTitle', { ns: 'customer' })}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t('booking.productsHint', { ns: 'customer' })}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                {t('units.items', { ns: 'common', count: products.length })}
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
                  onOpen={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </section>
        </div>

        <form
          onSubmit={handleSubmit}
          className="h-fit space-y-4 rounded-2xl border border-white/80 bg-white p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-6"
        >
          {isLiffMode && liffAuthStatus !== 'authenticated' && (
            <section
              className={`rounded-xl border p-4 ${
                liffAuthStatus === 'error'
                  ? 'border-red-100 bg-red-50 text-red-800'
                  : 'border-brand-100 bg-brand-50 text-brand-800'
              }`}
            >
              <h2 className="text-sm font-bold">
                {liffAuthStatus === 'error'
                  ? t('home.authRequired', { ns: 'customer' })
                  : t('home.authenticating', { ns: 'customer' })}
              </h2>
              <p className="mt-1 text-xs leading-5">
                {liffAuthStatus === 'error'
                  ? (liffAuthError?.message ?? t('booking.lineAuthFailed', { ns: 'customer' }))
                  : t('booking.linkingLine', { ns: 'customer' })}
              </p>
            </section>
          )}

          {activeBookingRecords.length > 0 && (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-emerald-950">
                    {t('booking.booked', { ns: 'customer' })}
                  </h2>
                  <p className="mt-1 text-xs text-emerald-800">
                    {t('booking.addBookingHint', { ns: 'customer' })}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {t('units.items', { ns: 'common', count: activeBookingRecords.length })}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {activeBookingRecords.slice(0, 3).map((record) => (
                  <button
                    key={record.queueEntryId}
                    type="button"
                    onClick={() => navigate(record.ticketPath)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-xs text-gray-600 hover:bg-emerald-100/60"
                  >
                    <span>{formatDateTime(record.createdAt, i18n.resolvedLanguage ?? 'ja')}</span>
                    <span className="font-bold text-gray-950">{formatJPY(record.subtotal)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div>
            <h2 className="text-lg font-bold text-gray-950">
              {t('booking.receptionDetails', { ns: 'customer' })}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t('booking.receptionHint', { ns: 'customer' })}
            </p>
          </div>

          <div className="space-y-3">
            <TextInput
              label={t('booking.nameRequiredLabel', { ns: 'customer' })}
              value={customerName}
              onChange={setCustomerName}
              placeholder={t('booking.namePlaceholder', { ns: 'customer' })}
              required
            />
            <TextInput
              label={t('booking.phoneRequiredLabel', { ns: 'customer' })}
              type="tel"
              value={customerPhone}
              onChange={setCustomerPhone}
              placeholder={t('booking.phonePlaceholder', { ns: 'customer' })}
              required
            />
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            {checkoutItems.length === 0 ? (
              <p className="text-sm text-gray-500">{t('booking.noItems', { ns: 'customer' })}</p>
            ) : (
              <div className="space-y-2">
                {checkoutItems.map((item) => (
                  <div key={item.productId} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.name} x {item.quantity}
                      </p>
                      {item.requiresPrepayment && (
                        <p className="mt-0.5 text-xs text-amber-700">
                          {t('booking.prepaymentItem', { ns: 'customer' })}
                        </p>
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
              <span className="text-sm font-medium text-gray-600">
                {t('labels.total', { ns: 'common' })}
              </span>
              <span className="text-xl font-bold text-gray-950">{formatJPY(subtotal)}</span>
            </div>
          </div>

          <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">
                  {t('booking.location', { ns: 'customer' })}
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {t('booking.locationHint', { ns: 'customer' })}
                </p>
              </div>
              <button
                type="button"
                onClick={requestCustomerLocation}
                className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                {t('booking.share', { ns: 'customer' })}
              </button>
            </div>
            {locationStatus && <p className="mt-2 text-xs text-gray-500">{locationStatus}</p>}
          </section>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={
              submitting ||
              !selectedQueue?.isAcceptingBookings ||
              cartItems.length === 0 ||
              !isLineAuthenticated
            }
            className="w-full rounded-xl bg-gray-950 px-4 py-3 text-base font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting
              ? t('booking.booking', { ns: 'customer' })
              : !selectedQueue?.isAcceptingBookings
                ? availabilityMessage
                : needsPrepayment && !canBook
                  ? t('booking.payAndBook', { ns: 'customer' })
                  : t('booking.book', { ns: 'customer' })}
          </button>
          {needsPrepayment && !canBook && (
            <p className="text-center text-xs leading-5 text-amber-700">
              {t('booking.payAndBookHint', { ns: 'customer' })}
            </p>
          )}
        </form>
      </main>
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

function CustomerLineRedirectState({ isConfigured }: Readonly<{ isConfigured: boolean }>) {
  const { t } = useTranslation(['customer', 'common']);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white p-8 text-center shadow-[var(--shadow-soft)]">
        <BrandLogo decorative className="mx-auto h-14 w-14" />
        <h1 className="mt-5 text-xl font-bold text-gray-950">
          {isConfigured
            ? t('booking.openingLine', { ns: 'customer' })
            : t('booking.lineEntryUnavailable', { ns: 'customer' })}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {isConfigured
            ? t('booking.openingLineHint', { ns: 'customer' })
            : t('booking.lineEntryUnavailableHint', { ns: 'customer' })}
        </p>
      </div>
    </div>
  );
}

function CustomerAccountRequiredPage({
  customerLineEntryUrl,
  dashboardPath,
}: Readonly<{
  customerLineEntryUrl: string | null;
  dashboardPath: string;
}>) {
  const { t } = useTranslation(['customer', 'common']);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <header className="border-b border-white/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo decorative className="h-10 w-10" />
            <p className="truncate text-sm font-bold text-gray-950 sm:text-base">
              {t('brandName', { ns: 'common' })}
            </p>
          </div>
          <div className="ml-auto">
            <LanguageSwitcher compact />
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-2xl items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-amber-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            {t('booking.customerAccountRequiredBadge', { ns: 'customer' })}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-gray-950">
            {t('booking.customerAccountRequiredTitle', { ns: 'customer' })}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {t('booking.customerAccountRequiredDescription', { ns: 'customer' })}
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {t('booking.customerAccountRequiredSessionHint', { ns: 'customer' })}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {customerLineEntryUrl && (
              <a
                href={customerLineEntryUrl}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
              >
                {t('booking.continueAsCustomerWithLine', { ns: 'customer' })}
              </a>
            )}
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              {t('booking.returnToDashboard', { ns: 'customer' })}
            </button>
          </div>
          {!customerLineEntryUrl && (
            <p className="mt-4 text-xs leading-5 text-amber-800">
              {t('booking.lineEntryUnavailable', { ns: 'customer' })}
            </p>
          )}
        </section>
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
  onOpen,
}: Readonly<{
  product: Product;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onQuantityChange: (quantity: number) => void;
  onOpen: () => void;
}>) {
  const { t, i18n } = useTranslation(['customer', 'common']);
  const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
  const maxQuantity = product.stock_quantity === null ? 99 : Math.max(0, product.stock_quantity);
  const atMax = quantity >= maxQuantity;

  return (
    <article
      className={`group relative rounded-2xl border border-white/80 bg-white p-4 shadow-[var(--shadow-soft)] transition ${
        outOfStock ? 'opacity-70' : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={t('booking.openProductDetails', { name: product.name })}
      >
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
                {t('booking.outOfStock', { ns: 'customer' })}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-bold text-gray-950">{product.name}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
              {product.product_type === 'service'
                ? t('labels.service', { ns: 'common' })
                : t('labels.product', { ns: 'common' })}
            </span>
          </div>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
              {product.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-brand-700">
              {formatJPY(product.price, i18n.resolvedLanguage)}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
              {t('units.minutes', { ns: 'common', count: product.service_time_minutes })}
            </span>
            {product.requires_prepayment && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                {t('manager:products.prepayment')}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {outOfStock
            ? t('booking.outOfStock', { ns: 'customer' })
            : product.stock_quantity === null
              ? t('booking.available', { ns: 'customer' })
              : t('booking.stock', { ns: 'customer', count: product.stock_quantity })}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrease}
            disabled={quantity === 0 || outOfStock}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            aria-label={t('booking.decreaseItem', { ns: 'customer', name: product.name })}
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
            aria-label={t('booking.itemQuantity', { ns: 'customer', name: product.name })}
          />
          <button
            type="button"
            onClick={onIncrease}
            disabled={outOfStock || atMax}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-40"
            aria-label={t('booking.increaseItem', { ns: 'customer', name: product.name })}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductDetailModal({
  product,
  onClose,
}: Readonly<{ product: Product; onClose: () => void }>) {
  const { t, i18n } = useTranslation(['customer', 'common', 'manager']);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <p className="font-mono text-xs font-bold text-brand-700">{product.product_code}</p>
            <h2 id="product-detail-title" className="mt-1 text-xl font-bold text-gray-950">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label={t('actions.close', { ns: 'common' })}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="aspect-video w-full object-cover"
          />
        )}
        <div className="space-y-5 p-5">
          {product.description && (
            <p className="whitespace-pre-line text-sm leading-7 text-gray-600">
              {product.description}
            </p>
          )}
          <dl className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
            <Detail
              label={t('labels.price', { ns: 'common' })}
              value={formatJPY(product.price, i18n.resolvedLanguage)}
            />
            <Detail
              label={t('manager:products.type')}
              value={
                product.product_type === 'service'
                  ? t('labels.service', { ns: 'common' })
                  : t('labels.product', { ns: 'common' })
              }
            />
            <Detail
              label={t('manager:products.serviceTime')}
              value={t('units.minutes', {
                ns: 'common',
                count: product.service_time_minutes,
              })}
            />
            <Detail
              label={t('manager:products.maxWaitLabel')}
              value={
                product.max_wait_minutes
                  ? t('units.minutes', { ns: 'common', count: product.max_wait_minutes })
                  : '-'
              }
            />
            <Detail
              label={t('manager:products.stock')}
              value={
                product.stock_quantity === null
                  ? t('units.unlimited', { ns: 'common' })
                  : String(product.stock_quantity)
              }
            />
            <Detail
              label={t('manager:products.prepayment')}
              value={
                product.requires_prepayment ? t('manager:products.yes') : t('manager:products.no')
              }
            />
          </dl>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gray-950 py-3 text-sm font-bold text-white"
          >
            {t('actions.close', { ns: 'common' })}
          </button>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-gray-950">{value}</dd>
    </div>
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
  required = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        name={type === 'tel' ? 'customerPhone' : 'customerName'}
        type={type}
        maxLength={type === 'tel' ? 20 : 100}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    </label>
  );
}
