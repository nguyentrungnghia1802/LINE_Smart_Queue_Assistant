/**
 * OpenAPI path definitions for customer-facing queue entry operations.
 * Base path: /api/v1/queue (mounted in v1.routes.ts as /queue)
 *
 * Route ordering (static before parameterised):
 *   POST   /join
 *   GET    /current
 *   GET    /me
 *   POST   /{entryId}/cancel
 *   POST   /{entryId}/skip
 *   GET    /{queueId}/status
 */

const bearerSecurity = [{ BearerAuth: [] }];

const ticketResponseEnvelope = {
  description: 'Ticket data',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/TicketResponse' },
        },
      },
    },
  },
};

const queueStatusEnvelope = {
  description: 'Queue status data',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/QueueStatusResponse' },
        },
      },
    },
  },
};

export const queueEntryPaths = {
  '/api/v1/queue/join': {
    post: {
      tags: ['queue-entry'],
      summary: 'Join a queue and receive a ticket',
      operationId: 'joinQueue',
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/JoinQueueRequest' },
          },
        },
      },
      responses: {
        201: ticketResponseEnvelope,
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { $ref: '#/components/responses/Conflict' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queue/current': {
    get: {
      tags: ['queue-entry'],
      summary: 'Get current live status of a specific queue',
      operationId: 'getCurrentQueue',
      security: bearerSecurity,
      parameters: [
        {
          name: 'queueId',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'The queue to inspect',
        },
      ],
      responses: {
        200: queueStatusEnvelope,
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queue/me': {
    get: {
      tags: ['queue-entry'],
      summary: "Get the authenticated user's active ticket",
      operationId: 'getMyTicket',
      security: bearerSecurity,
      responses: {
        200: ticketResponseEnvelope,
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/v1/queue/{entryId}/cancel': {
    post: {
      tags: ['queue-entry'],
      summary: 'Cancel a queue ticket',
      operationId: 'cancelTicket',
      security: bearerSecurity,
      parameters: [
        {
          name: 'entryId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Queue entry (ticket) ID',
        },
      ],
      responses: {
        200: ticketResponseEnvelope,
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { $ref: '#/components/responses/Conflict' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queue/{entryId}/skip': {
    post: {
      tags: ['queue-entry'],
      summary: 'Skip a turn — push ticket back one position',
      operationId: 'skipTicket',
      security: bearerSecurity,
      parameters: [
        {
          name: 'entryId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Queue entry (ticket) ID',
        },
      ],
      responses: {
        200: ticketResponseEnvelope,
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { $ref: '#/components/responses/Conflict' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/queue/{queueId}/status': {
    get: {
      tags: ['queue-entry'],
      summary: 'Get the real-time status of a queue by its ID',
      operationId: 'getQueueStatus',
      parameters: [
        {
          name: 'queueId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Queue ID',
        },
      ],
      responses: {
        200: queueStatusEnvelope,
        404: { $ref: '#/components/responses/NotFound' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },
} as const;
