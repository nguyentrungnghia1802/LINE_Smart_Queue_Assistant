import type { ApiError, ApiResponse, ResponseMeta } from '../types';

/**
 * Zero-pad a queue ticket number for display.
 * e.g. formatTicketNumber(5) → "005"
 */
export function formatTicketNumber(num: number, digits = 3): string {
  return String(num).padStart(digits, '0');
}

/**
 * Estimate wait time in minutes based on queue position.
 * Position 1 = currently served → 0 minutes wait.
 */
export function estimateWaitMinutes(position: number, avgServiceTimeMinutes: number): number {
  return Math.max(0, (position - 1) * avgServiceTimeMinutes);
}

/**
 * Build a successful API response envelope.
 */
export function buildSuccessResponse<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

/**
 * Build an error API response envelope.
 */
export function buildErrorResponse(error: ApiError): ApiResponse<never> {
  return { success: false, error };
}

/**
 * Compute total pages from total count and page size.
 */
export function computeTotalPages(total: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.ceil(total / limit);
}

/**
 * Type guard — truthy, non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
