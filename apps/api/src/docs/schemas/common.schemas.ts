/**
 * Reusable OpenAPI 3.0 component schemas.
 *
 * Naming: PascalCase per OpenAPI convention.
 * Response shapes mirror apps/api/src/utils/response.ts exactly.
 */
export const commonSchemas = {
  // ── Error envelope ───────────────────────────────────────────────────────────
  ErrorResponse: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
            description: 'Machine-readable error code from ERROR_CODES in @line-queue/shared',
          },
          message: {
            type: 'string',
            example: 'Request validation failed',
          },
          details: {
            description: 'Zod flatten() output on 422; arbitrary debug data on 500 (dev only).',
            type: 'object',
            nullable: true,
            properties: {
              formErrors: { type: 'array', items: { type: 'string' } },
              fieldErrors: {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },

  // ── Pagination ───────────────────────────────────────────────────────────────
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages'],
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 100 },
      totalPages: { type: 'integer', example: 5 },
    },
  },

  // ── Base entity ──────────────────────────────────────────────────────────────
  BaseEntity: {
    type: 'object',
    required: ['id', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;

// ── Reusable response wrappers ───────────────────────────────────────────────────

/** Build a standard success response schema wrapping an arbitrary $ref */
export function successResponseOf(dataRef: string): object {
  return {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: dataRef },
    },
  };
}

/** Build a paginated list response schema wrapping an array of a $ref */
export function paginatedResponseOf(itemRef: string): object {
  return {
    type: 'object',
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'array', items: { $ref: itemRef } },
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
  };
}
