import type {
  EtaConfidence,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  OperationMode,
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
  description?: string;
  lineChannelId?: string;
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
