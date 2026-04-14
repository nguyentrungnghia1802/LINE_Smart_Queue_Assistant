// ─────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ─────────────────────────────────────────────────────
// Error detail
// ─────────────────────────────────────────────────────

/** Field-level validation error reported inside a 422 response */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Error payload carried by every failed API response.
 * `code` must be a value from ERROR_CODES.
 */
export interface ApiError {
  code: string;
  message: string;
  /** Field-level validation errors — present on 422 responses */
  fieldErrors?: FieldError[];
  /** Arbitrary debug details — only included in development mode */
  details?: unknown;
}

// ─────────────────────────────────────────────────────
// Response metadata (non-pagination)
// ─────────────────────────────────────────────────────

export interface ResponseMeta {
  requestId?: string;
  processingTimeMs?: number;
}

// ─────────────────────────────────────────────────────
// Response envelopes — discriminated union on `success`
// ─────────────────────────────────────────────────────

/** Single-item success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/** Paginated list success response */
export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

/** Error response — same shape regardless of error type */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Union for single-item endpoints.
 * Narrow with `if (res.success)` before accessing `data`.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Union for list / paginated endpoints.
 * Narrow with `if (res.success)` before accessing `data` and `meta`.
 */
export type ApiListResponse<T> = ApiPaginatedResponse<T> | ApiErrorResponse;
