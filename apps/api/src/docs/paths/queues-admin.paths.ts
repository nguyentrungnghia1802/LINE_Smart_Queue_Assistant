/**
 * OpenAPI path definitions for admin queue management.
 * Base path: /api/v1/queues
 */

const bearerSecurity = [{ BearerAuth: [] }];

const queueObjectSchema = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', example: true },
    data: { $ref: '#/components/schemas/AdminQueueResponse' },
  },
};

export const queuesAdminPaths = {
  '/api/v1/queues': {
    get: {
      tags: ['queues'],
      summary: 'List all queues (admin)',
      operationId: 'listQueues',
      security: bearerSecurity,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        200: {
          description: 'Paginated queue list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'meta'],
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/AdminQueueResponse' },
                  },
                  meta: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },

    post: {
      tags: ['queues'],
      summary: 'Create a new queue',
      operationId: 'createQueue',
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateQueueRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Queue created',
          content: { 'application/json': { schema: queueObjectSchema } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queues/{id}': {
    get: {
      tags: ['queues'],
      summary: 'Get a queue by ID',
      operationId: 'getQueue',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'Queue data',
          content: { 'application/json': { schema: queueObjectSchema } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },

    patch: {
      tags: ['queues'],
      summary: 'Update queue fields',
      operationId: 'updateQueue',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateQueueRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Queue updated',
          content: { 'application/json': { schema: queueObjectSchema } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },

    delete: {
      tags: ['queues'],
      summary: 'Delete a queue',
      operationId: 'deleteQueue',
      security: bearerSecurity,
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        204: { description: 'Queue deleted' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queues/{id}/status': {
    patch: {
      tags: ['queues'],
      summary: 'Update queue status (open / paused / closed)',
      operationId: 'updateQueueStatus',
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
              required: ['status'],
              properties: {
                status: { type: 'string', enum: ['open', 'paused', 'closed'] },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Status updated',
          content: { 'application/json': { schema: queueObjectSchema } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
} as const;
