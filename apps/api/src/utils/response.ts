import { Response } from 'express';

// ── Standard response shapes ───────────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** 200 OK with JSON body. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: SuccessResponse<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

/** 201 Created — shorthand for sendSuccess(res, data, 201). */
export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

/** 204 No Content — no body. */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/** 200 with data array + pagination meta. */
export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): Response {
  const body: PaginatedResponse<T> = { success: true, data, meta };
  return res.status(200).json(body);
}

/** Generic error response — used by the error handler middleware. */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  return res.status(statusCode).json(body);
}
