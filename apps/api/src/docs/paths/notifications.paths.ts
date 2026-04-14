/**
 * OpenAPI path definitions for notification management.
 * Base path: /api/v1/notifications
 */

const bearerSecurity = [{ BearerAuth: [] }];

export const notificationsPaths = {
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
