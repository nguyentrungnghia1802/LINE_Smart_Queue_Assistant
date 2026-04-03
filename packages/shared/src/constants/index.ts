// ─────────────────────────────────────────────────────
// API routing
// ─────────────────────────────────────────────────────
export const API_VERSION = 'v1' as const;
export const API_BASE_PATH = `/api/${API_VERSION}` as const;

// ─────────────────────────────────────────────────────
// Pagination defaults
// ─────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

// ─────────────────────────────────────────────────────
// Domain limits
// ─────────────────────────────────────────────────────
export const QUEUE_LIMITS = {
  MAX_CAPACITY: 1000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
} as const;

export const TICKET_LIMITS = {
  MAX_NOTES_LENGTH: 1000,
} as const;

// ─────────────────────────────────────────────────────
// HTTP status codes (subset used in this project)
// ─────────────────────────────────────────────────────
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ─────────────────────────────────────────────────────
// Application error codes
// ─────────────────────────────────────────────────────
export const ERROR_CODES = {
  // Auth
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  // Queue
  QUEUE_NOT_FOUND: 'QUEUE_NOT_FOUND',
  QUEUE_FULL: 'QUEUE_FULL',
  QUEUE_CLOSED: 'QUEUE_CLOSED',
  QUEUE_PAUSED: 'QUEUE_PAUSED',
  // Ticket
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_INVALID_STATUS_TRANSITION: 'TICKET_INVALID_STATUS_TRANSITION',
  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
