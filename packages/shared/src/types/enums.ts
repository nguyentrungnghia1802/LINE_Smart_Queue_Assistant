// ─────────────────────────────────────────────────────
// Queue domain
// ─────────────────────────────────────────────────────

/** Operational state of a Queue */
export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

/**
 * Operation mode — extensibility hook for disaster / maintenance scenarios.
 * Stored on the Organization entity; affects all queues in the org.
 */
export enum OperationMode {
  NORMAL = 'NORMAL',
  /** Reduced capacity; priority-based ticket processing */
  DISASTER = 'DISASTER',
  /** All queues frozen; informational banner shown to customers */
  MAINTENANCE = 'MAINTENANCE',
}

// ─────────────────────────────────────────────────────
// Ticket domain
// ─────────────────────────────────────────────────────

/** Full lifecycle of a Ticket */
export enum TicketStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  SERVING = 'SERVING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/**
 * Reason a penalty was issued.
 * Extensibility hook for fairness / abuse-prevention features.
 */
export enum PenaltyReason {
  NO_SHOW = 'NO_SHOW',
  LATE_ARRIVAL = 'LATE_ARRIVAL',
  POLICY_ABUSE = 'POLICY_ABUSE',
}

// ─────────────────────────────────────────────────────
// User domain
// ─────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

// ─────────────────────────────────────────────────────
// Notification domain
// ─────────────────────────────────────────────────────

export enum NotificationType {
  /** Customer just joined the queue */
  TICKET_ISSUED = 'TICKET_ISSUED',
  /** N tickets ahead — approaching threshold */
  TURN_APPROACHING = 'TURN_APPROACHING',
  /** Customer is next to be served */
  TURN_NOW = 'TURN_NOW',
  /** Ticket auto-cancelled due to no-show */
  TICKET_EXPIRED = 'TICKET_EXPIRED',
  QUEUE_PAUSED = 'QUEUE_PAUSED',
  QUEUE_RESUMED = 'QUEUE_RESUMED',
  QUEUE_CLOSED = 'QUEUE_CLOSED',
}

export enum NotificationChannel {
  LINE = 'LINE',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  /** User opted out or recipient identifier unavailable */
  SKIPPED = 'SKIPPED',
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
