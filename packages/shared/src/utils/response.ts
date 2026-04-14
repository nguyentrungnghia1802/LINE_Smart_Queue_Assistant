import type {
  ApiError,
  ApiErrorResponse,
  ApiPaginatedResponse,
  ApiSuccessResponse,
  PaginationMeta,
  ResponseMeta,
} from '../types/api';

/**
 * Build a typed single-item success envelope.
 */
export function buildSuccessResponse<T>(data: T, meta?: ResponseMeta): ApiSuccessResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

/**
 * Build a typed paginated list success envelope.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  paginationMeta: PaginationMeta
): ApiPaginatedResponse<T> {
  return { success: true, data, meta: paginationMeta };
}

/**
 * Build a typed error envelope.
 */
export function buildErrorResponse(error: ApiError): ApiErrorResponse {
  return { success: false, error };
}

/**
 * Build a PaginationMeta object from raw counts.
 * Always call this instead of constructing PaginationMeta manually
 * to ensure `hasNextPage` / `hasPreviousPage` are consistent.
 */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
