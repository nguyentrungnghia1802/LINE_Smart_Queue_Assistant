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
// Queue limits
// ─────────────────────────────────────────────────────

export const QUEUE_LIMITS = {
  MAX_CAPACITY: 1_000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  /** Maximum character length of the ticket prefix (e.g. "A", "VIP") */
  MAX_TICKET_PREFIX_LEN: 3,
  /** Maximum number of queues per organization */
  MAX_QUEUES_PER_ORG: 50,
} as const;

// ─────────────────────────────────────────────────────
// Ticket limits
// ─────────────────────────────────────────────────────

export const TICKET_LIMITS = {
  MAX_NOTES_LENGTH: 1_000,
  /** Zero-pad ticket numbers to this width for display, e.g. "005" */
  NUMBER_DISPLAY_DIGITS: 3,
  /** Maximum concurrent active tickets a single user may hold */
  MAX_ACTIVE_PER_USER: 3,
} as const;

// ─────────────────────────────────────────────────────
// ETA thresholds
// ─────────────────────────────────────────────────────

export const ETA_CONFIG = {
  /** Positions-ahead count at or below which ETA confidence is HIGH */
  HIGH_CONFIDENCE_THRESHOLD: 5,
  /** Positions-ahead count at or below which ETA confidence is MEDIUM */
  MEDIUM_CONFIDENCE_THRESHOLD: 20,
  /**
   * Send a TURN_APPROACHING notification when this many tickets
   * remain ahead of the customer.
   */
  APPROACHING_THRESHOLD: 3,
} as const;

// ─────────────────────────────────────────────────────
// Notification config
// ─────────────────────────────────────────────────────

export const NOTIFICATION_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2_000,
  MAX_TITLE_LENGTH: 60,
  MAX_BODY_LENGTH: 400,
} as const;

// ─────────────────────────────────────────────────────
// Penalty config — extensibility hook for fairness features
// ─────────────────────────────────────────────────────

export const PENALTY_CONFIG = {
  /** Cooldown duration (ms) added for each no-show */
  NO_SHOW_COOLDOWN_MS: 30 * 60 * 1_000, // 30 minutes
  /** Accumulated no-show count that triggers a permanent suspension review */
  MAX_NO_SHOW_COUNT: 5,
} as const;

// ─────────────────────────────────────────────────────
// Disaster / maintenance mode — extensibility hook
// ─────────────────────────────────────────────────────

export const OPERATION_MODE_CONFIG = {
  /**
   * Fraction of maxCapacity used during DISASTER mode.
   * e.g. 0.5 → accept at most 50% of normal capacity.
   */
  DISASTER_CAPACITY_FACTOR: 0.5,
} as const;
