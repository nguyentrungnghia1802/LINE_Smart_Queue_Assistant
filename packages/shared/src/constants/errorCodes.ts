/**
 * Canonical application error codes.
 *
 * Rules:
 *   - Group by domain prefix: AUTH_, QUEUE_, TICKET_, USER_, ORG_, NOTIF_
 *   - Generic / cross-cutting codes are unprefixed
 *   - Values must match what the backend's AppError class uses
 *   - Frontend error handlers should switch on these literals
 */
export const ERROR_CODES = {
  // ── Auth ──────────────────────────────────────────────
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_LINE_OAUTH_FAILED: 'AUTH_LINE_OAUTH_FAILED',

  // ── Organization ──────────────────────────────────────
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  /** Org is in DISASTER or MAINTENANCE mode — operation rejected */
  ORG_OPERATION_SUSPENDED: 'ORG_OPERATION_SUSPENDED',

  // ── Queue ──────────────────────────────────────────────
  QUEUE_NOT_FOUND: 'QUEUE_NOT_FOUND',
  QUEUE_FULL: 'QUEUE_FULL',
  QUEUE_CLOSED: 'QUEUE_CLOSED',
  QUEUE_PAUSED: 'QUEUE_PAUSED',
  QUEUE_INVALID_STATUS_CHANGE: 'QUEUE_INVALID_STATUS_CHANGE',

  // ── Ticket ─────────────────────────────────────────────
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_INVALID_STATUS_TRANSITION: 'TICKET_INVALID_STATUS_TRANSITION',
  /** User already has an active ticket in this queue */
  TICKET_ALREADY_ACTIVE: 'TICKET_ALREADY_ACTIVE',

  // ── User ───────────────────────────────────────────────
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  /** User is in penalty cooldown and cannot join a queue */
  USER_PENALTY_COOLDOWN: 'USER_PENALTY_COOLDOWN',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',

  // ── Notification ───────────────────────────────────────
  NOTIF_DELIVERY_FAILED: 'NOTIF_DELIVERY_FAILED',
  NOTIF_RATE_LIMITED: 'NOTIF_RATE_LIMITED',

  // ── Generic ────────────────────────────────────────────
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
