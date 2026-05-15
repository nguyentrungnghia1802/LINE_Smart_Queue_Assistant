import type {
  EtaConfidence,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  OperationMode,
  OrderStatus,
  PaymentStatus,
  PenaltyReason,
  QueueStatus,
  TicketStatus,
  UserRole,
} from './enums';

// ─────────────────────────────────────────────────────
// Base
// ─────────────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────
// Organization
// ─────────────────────────────────────────────────────

export interface Organization extends BaseEntity {
  name: string;
  slug?: string;
  description?: string;
  lineChannelId?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  paymentInfo?: string;
  /** Current operation mode — drives queue-level behaviour across the org */
  operationMode: OperationMode;
}

// ─────────────────────────────────────────────────────
// Queue
// ─────────────────────────────────────────────────────

export interface Queue extends BaseEntity {
  name: string;
  description?: string;
  status: QueueStatus;
  currentNumber: number;
  maxCapacity?: number;
  /** Average minutes per ticket — used for ETA calculation */
  avgServiceTimeMinutes?: number;
  organizationId: string;
  /** Prefix prepended to display number, e.g. "A" → "A001" */
  ticketPrefix?: string;
  /** Relative sort order when listing queues within an org */
  displayOrder?: number;
}

/** Queue enriched with live counters — used in list / dashboard views */
export interface QueueSummary extends Queue {
  waitingCount: number;
  servingCount: number;
}

// ─────────────────────────────────────────────────────
// Ticket (queue entry)
// ─────────────────────────────────────────────────────

export interface Ticket extends BaseEntity {
  /** Monotonically increasing display number within the queue */
  number: number;
  status: TicketStatus;
  queueId: string;
  userId?: string;
  lineUserId?: string;
  estimatedCallTime?: Date;
  calledAt?: Date;
  servedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  notes?: string;
}

/** Ticket enriched with live ETA info — used in detail / LINE message views */
export interface TicketWithEta extends Ticket {
  eta: EtaInfo;
  positionInQueue: number;
}

// ─────────────────────────────────────────────────────
// ETA
// ─────────────────────────────────────────────────────

export interface EtaInfo {
  positionInQueue: number;
  estimatedWaitMinutes: number;
  /** null when avgServiceTimeMinutes is unavailable */
  estimatedCallTime: Date | null;
  confidence: EtaConfidence;
}

// ─────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────

export interface User extends BaseEntity {
  email?: string;
  lineUserId?: string;
  displayName?: string;
  pictureUrl?: string;
  role: UserRole;
  organizationId?: string;
  isActive: boolean;
  penaltyCount: number;
  /** User cannot join any queue until this timestamp */
  penaltyCooldownUntil?: Date;
}

// ─────────────────────────────────────────────────────
// Penalty — extensibility hook for fairness / abuse prevention
// ─────────────────────────────────────────────────────

export interface PenaltyRecord extends BaseEntity {
  userId: string;
  ticketId: string;
  queueId: string;
  reason: PenaltyReason;
  /** null = permanent ban */
  expiresAt: Date | null;
  /** Staff userId who issued the penalty, if applicable */
  issuedBy?: string;
}

// ─────────────────────────────────────────────────────
// Notification
// ─────────────────────────────────────────────────────

export interface NotificationPayload {
  /** Short headline — used in LINE flex messages / push notifications */
  title: string;
  /** Main body text */
  body: string;
  /** Arbitrary key-value data for template rendering */
  data?: Record<string, string | number | boolean>;
}

export interface Notification extends BaseEntity {
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipientLineUserId?: string;
  recipientEmail?: string;
  ticketId?: string;
  queueId?: string;
  organizationId?: string;
  payload: NotificationPayload;
  sentAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

// ─────────────────────────────────────────────────────
// Product / Service
// ─────────────────────────────────────────────────────

export interface Product extends BaseEntity {
  organizationId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  /** Price in VND (or local currency) */
  price: number;
  /** Average service time per customer in minutes */
  serviceTimeMinutes: number;
  /** Minutes before auto-cancel if customer hasn't been served */
  maxWaitMinutes?: number;
  requiresPrepayment: boolean;
  /** null = unlimited */
  stockQuantity?: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productPrice: number;
  serviceTimeMinutes: number;
  quantity: number;
  subtotal: number;
  createdAt: Date;
}

export interface Order extends BaseEntity {
  organizationId: string;
  queueEntryId?: string;
  orderNumber: string;
  customerName?: string;
  status: OrderStatus;
  subtotal: number;
  paymentStatus: PaymentStatus;
  paymentCode?: string;
  notes?: string;
  items?: OrderItem[];
}

export interface OrderWithQueue extends Order {
  ticketDisplay?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
}
