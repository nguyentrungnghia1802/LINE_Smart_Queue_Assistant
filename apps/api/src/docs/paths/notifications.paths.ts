/**
 * OpenAPI path definitions for notification management.
 * Base path: /api/v1/notifications
 */

const bearerSecurity = [{ BearerAuth: [] }];

export const notificationsPaths = {
  '/api/v1/notifications/operations': {
    get: {
      tags: ['notifications'],
      summary: 'List tenant-scoped LINE notification deliveries',
      operationId: 'listNotificationOperations',
      security: bearerSecurity,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
          },
        },
        { name: 'organizationId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'branchId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'eventType', in: 'query', schema: { type: 'string' } },
        { name: 'createdFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'createdTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
      ],
      responses: {
        200: {
          description: 'Safe paginated delivery operations list',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
  '/api/v1/notifications/operations/{id}': {
    get: {
      tags: ['notifications'],
      summary: 'Get one tenant-scoped notification delivery',
      operationId: 'getNotificationOperation',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'Sanitized delivery detail',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NotificationOperationDetail' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/api/v1/notifications/operations/{id}/retry': {
    post: {
      tags: ['notifications'],
      summary: 'Retry a retryable failed delivery',
      operationId: 'retryNotificationOperation',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
            },
          },
        },
      },
      responses: {
        200: { description: 'Retry scheduled' },
        409: { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/api/v1/notifications/operations/{id}/cancel': {
    post: {
      tags: ['notifications'],
      summary: 'Cancel an obsolete pending delivery for a terminal ticket',
      operationId: 'cancelNotificationOperation',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
            },
          },
        },
      },
      responses: {
        200: { description: 'Delivery cancelled or already cancelled' },
        409: { $ref: '#/components/responses/Conflict' },
      },
    },
  },
  '/api/v1/notifications': {
    get: {
      tags: ['notifications'],
      summary: "List the authenticated user's notifications",
      operationId: 'listNotifications',
      security: bearerSecurity,
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        {
          name: 'channel',
          in: 'query',
          schema: { type: 'string', enum: ['LINE', 'EMAIL', 'PUSH'] },
          description: 'Filter by delivery channel',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] },
          description: 'Filter by delivery status',
        },
      ],
      responses: {
        200: {
          description: 'Paginated notification list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'meta'],
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/NotificationResponse' },
                  },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
} as const;
