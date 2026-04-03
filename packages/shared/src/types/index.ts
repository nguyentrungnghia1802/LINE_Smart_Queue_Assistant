// ─────────────────────────────────────────────────────
// Domain enums
// ─────────────────────────────────────────────────────

/** Lifecycle state of a Queue */
export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
}

/** Lifecycle state of a Ticket inside a Queue */
export enum TicketStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  SERVING = 'SERVING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Roles available in the system */
export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

// ─────────────────────────────────────────────────────
// Base entity
// ─────────────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────
// Domain entities
// ─────────────────────────────────────────────────────

export interface Organization extends BaseEntity {
  name: string;
  description?: string;
  /** LINE Messaging API channel linked to this org */
  lineChannelId?: string;
}

export interface Queue extends BaseEntity {
  name: string;
  description?: string;
  status: QueueStatus;
  currentNumber: number;
  maxCapacity?: number;
  /** Average minutes needed per ticket — used for ETA calculation */
  avgServiceTimeMinutes?: number;
  organizationId: string;
}

export interface Ticket extends BaseEntity {
  /** Monotonically increasing display number within the queue */
  number: number;
  status: TicketStatus;
  queueId: string;
  userId?: string;
  lineUserId?: string;
  estimatedCallTime?: Date;
  calledAt?: Date;
  completedAt?: Date;
  notes?: string;
}

export interface User extends BaseEntity {
  email?: string;
  lineUserId?: string;
  displayName?: string;
  pictureUrl?: string;
  role: UserRole;
  organizationId?: string;
}

// ─────────────────────────────────────────────────────
// API contract types
// ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}
