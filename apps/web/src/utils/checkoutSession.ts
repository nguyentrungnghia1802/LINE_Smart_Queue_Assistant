export interface CheckoutItem {
  productId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  requiresPrepayment: boolean;
}

export interface CheckoutSession {
  id: string;
  orgSlug: string;
  orgName: string;
  returnPath: string;
  cartSignature: string;
  paymentKey: string;
  paymentKeyBase?: string;
  scope: 'required_items' | 'all_items';
  preferredMethod?: string;
  items: CheckoutItem[];
  subtotal: number;
  coveredProductIds: string[];
  requiredProductIds?: string[];
  requiredSubtotal?: number;
  createdAt: string;
}

export interface PaidCheckout {
  paid: true;
  transactionId: string;
  method: string;
  code: string;
  amount: number;
  scope: 'required_items' | 'all_items';
  coveredProductIds: string[];
  cartSignature: string;
  paidAt: string;
}

export interface CheckoutDraft {
  cart: Record<string, number>;
  customerName: string;
  customerPhone: string;
}

export interface BookingRecord {
  orderId: string;
  queueEntryId: string;
  ticketPath: string;
  createdAt: string;
  items: CheckoutItem[];
  subtotal: number;
  paymentScope?: 'required_items' | 'all_items';
  paymentCode?: string;
}

export interface BookingGroup {
  id: string;
  orgSlug: string;
  token?: string;
  localDeviceKey: string;
  records: BookingRecord[];
  updatedAt: string;
}

export const CHECKOUT_SESSION_PREFIX = 'line-smart-queue:checkout:';
export const PAID_CHECKOUT_PREFIX = 'line-smart-queue:paid:';
export const CHECKOUT_DRAFT_PREFIX = 'line-smart-queue:draft:';
export const BOOKING_GROUP_PREFIX = 'line-smart-queue:booking-group:';
export const LOCAL_DEVICE_KEY = 'line-smart-queue:device-key';

export function createCheckoutId(): string {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function saveCheckoutSession(session: CheckoutSession) {
  sessionStorage.setItem(`${CHECKOUT_SESSION_PREFIX}${session.id}`, JSON.stringify(session));
}

export function loadCheckoutSession(id: string): CheckoutSession | null {
  const raw = sessionStorage.getItem(`${CHECKOUT_SESSION_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutSession;
  } catch {
    return null;
  }
}

export function savePaidCheckout(paymentKey: string, paid: PaidCheckout) {
  sessionStorage.setItem(`${PAID_CHECKOUT_PREFIX}${paymentKey}`, JSON.stringify(paid));
}

export function loadPaidCheckout(paymentKey: string): PaidCheckout | null {
  const raw = sessionStorage.getItem(`${PAID_CHECKOUT_PREFIX}${paymentKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaidCheckout;
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(key: string, draft: CheckoutDraft) {
  sessionStorage.setItem(`${CHECKOUT_DRAFT_PREFIX}${key}`, JSON.stringify(draft));
}

export function loadCheckoutDraft(key: string): CheckoutDraft | null {
  const raw = sessionStorage.getItem(`${CHECKOUT_DRAFT_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutDraft;
  } catch {
    return null;
  }
}

export function paymentKeyFor(base: string, scope: 'required_items' | 'all_items'): string {
  return `${base}:${scope}`;
}

export function getLocalDeviceKey(): string {
  const existing = localStorage.getItem(LOCAL_DEVICE_KEY);
  if (existing) return existing;
  const key = createCheckoutId();
  localStorage.setItem(LOCAL_DEVICE_KEY, key);
  return key;
}

export function loadBookingGroup(key: string): BookingGroup | null {
  const raw = localStorage.getItem(`${BOOKING_GROUP_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingGroup;
  } catch {
    return null;
  }
}

export function appendBookingRecord(
  key: string,
  init: { orgSlug: string; token?: string; localDeviceKey: string; groupId?: string },
  record: BookingRecord
): BookingGroup {
  const existing = loadBookingGroup(key);
  const group: BookingGroup = existing ?? {
    id: init.groupId ?? createCheckoutId(),
    orgSlug: init.orgSlug,
    token: init.token,
    localDeviceKey: init.localDeviceKey,
    records: [],
    updatedAt: new Date().toISOString(),
  };
  const next = {
    ...group,
    orgSlug: init.orgSlug,
    token: init.token,
    localDeviceKey: init.localDeviceKey,
    records: [record, ...group.records].slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(`${BOOKING_GROUP_PREFIX}${key}`, JSON.stringify(next));
  return next;
}

export function cartSignature(items: Array<{ productId: string; quantity: number }>): string {
  return items
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((item) => `${item.productId}:${item.quantity}`)
    .join('|');
}

export function formatJPY(value: number | string) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
