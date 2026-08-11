// ─────────────────────────────────────────────────────
// Queue domain
// ─────────────────────────────────────────────────────

/** Operational state of a Queue */
export enum QueueStatus {
  ACTIVE = 'open',
  PAUSED = 'paused',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

// ─────────────────────────────────────────────────────
// Ticket domain
// ─────────────────────────────────────────────────────

/** Full lifecycle of a Ticket */
export enum TicketStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  SERVING = 'serving',
  SERVED = 'served',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/**
 * Reason a penalty was issued.
 * Extensibility hook for fairness / abuse-prevention features.
 */
export enum PenaltyReason {
  NO_SHOW = 'no_show',
  LATE_ARRIVAL = 'late_arrival',
  EXCESSIVE_CANCEL = 'excessive_cancel',
  MANUAL = 'manual',
}

// ─────────────────────────────────────────────────────
// User domain
// ─────────────────────────────────────────────────────

/** Values match the `user_role` PostgreSQL ENUM (lowercase). */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
  CUSTOMER = 'customer',
}

// ─────────────────────────────────────────────────────
// Order domain
// ─────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────
// Product domain
// ─────────────────────────────────────────────────────

/** Distinguishes tangible goods from services in the product catalog. */
export enum ProductType {
  PRODUCT = 'product',
  SERVICE = 'service',
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ─────────────────────────────────────────────────────
// Notification domain
// ─────────────────────────────────────────────────────

export enum NotificationType {
  BOOKING_CREATED = 'booking_created',
  ETA_WARNING = 'eta_warning',
  CALLED = 'called',
  SERVING = 'serving',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  DEFERRED = 'deferred',
  LOCATION_WARNING = 'location_warning',
}

export enum NotificationChannel {
  LINE_PUSH = 'line_push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ─────────────────────────────────────────────────────
// ETA
// ─────────────────────────────────────────────────────

export enum EtaConfidence {
  /** Fewer than 5 people ahead, stable service time */
  HIGH = 'HIGH',
  /** Moderate queue length or variable service time */
  MEDIUM = 'MEDIUM',
  /** Large queue or no historical service-time data */
  LOW = 'LOW',
}
