import { TICKET_LIMITS } from '../constants/domain';

/**
 * Zero-pad a ticket number for display.
 * e.g. formatTicketNumber(5) → "005"
 */
export function formatTicketNumber(
  num: number,
  digits = TICKET_LIMITS.NUMBER_DISPLAY_DIGITS
): string {
  return String(num).padStart(digits, '0');
}

/**
 * Format the full display code for a ticket, including the queue prefix.
 * e.g. formatTicketCode('A', 5) → "A005"
 * e.g. formatTicketCode(undefined, 5) → "005"
 */
export function formatTicketCode(prefix: string | undefined, num: number): string {
  return `${prefix ?? ''}${formatTicketNumber(num)}`;
}

/**
 * Type guard — truthy, non-empty string (trims whitespace).
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Compute total pages from total count and page size.
 * @deprecated Use buildPaginationMeta from utils/response instead.
 */
export function computeTotalPages(total: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.ceil(total / limit);
}
