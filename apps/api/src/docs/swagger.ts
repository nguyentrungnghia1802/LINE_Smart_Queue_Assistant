/**
 * OpenAPI 3.0.3 specification for the LINE Smart Queue API.
 *
 * Spec is built as a plain TypeScript object (no JSDoc scatter, no swagger-jsdoc).
 * All schemas and paths are imported from their respective modules under src/docs/.
 *
 * Served at:
 *   GET /api/docs      — swagger-ui-express HTML (non-production only)
 *   GET /api/docs.json — raw JSON spec for Postman / CI tooling
 */

import { config } from '../config';

import { linePaths } from './paths/line.paths';
import { notificationsPaths } from './paths/notifications.paths';
import { queueEntryPaths } from './paths/queue-entry.paths';
import { queuesAdminPaths } from './paths/queues-admin.paths';
import { commonSchemas } from './schemas/common.schemas';
import { notificationSchemas } from './schemas/notification.schemas';
import { queueEntrySchemas } from './schemas/queue-entry.schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Admin-facing queue schemas referenced from queues-admin.paths.ts
// ─────────────────────────────────────────────────────────────────────────────

const adminQueueSchemas = {
  AdminQueueResponse: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        required: ['orgId', 'name', 'status'],
        properties: {
          orgId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'General Service' },
          description: { type: 'string', nullable: true },
          prefix: { type: 'string', example: 'A', nullable: true },
          status: { type: 'string', enum: ['open', 'paused', 'closed'] },
          maxCapacity: { type: 'integer', nullable: true },
          avgServiceMs: {
            type: 'integer',
            nullable: true,
            description: 'Average service time in milliseconds',
          },
        },
      },
    ],
  },

  CreateQueueRequest: {
    type: 'object',
    required: ['orgId', 'name'],
    properties: {
      orgId: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 500 },
      prefix: { type: 'string', maxLength: 10 },
      maxCapacity: { type: 'integer', minimum: 1 },
      avgServiceMs: { type: 'integer', minimum: 1 },
    },
  },

  UpdateQueueRequest: {
    type: 'object',
    description: 'At least one field must be provided.',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 500 },
      status: { type: 'string', enum: ['open', 'paused', 'closed'] },
      maxCapacity: { type: 'integer', minimum: 1 },
      avgServiceMs: { type: 'integer', minimum: 1 },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spec assembly
// ─────────────────────────────────────────────────────────────────────────────

export const swaggerSpec = {
  openapi: '3.0.3',

  info: {
    title: 'LINE Smart Queue API',
    version: '1.0.0',
    description:
      'REST API for the LINE Smart Queue Assistant — queue management, ' +
      'customer ticket operations, and LINE Messaging webhook integration.\n\n' +
      '**Note**: stub endpoints return `501 Not Implemented` until domain logic is wired up.',
    contact: {
      name: 'LINE Smart Queue Team',
    },
  },

  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: 'Local development',
    },
    {
      url: 'https://api.line-queue.example.com',
      description: 'Production',
    },
  ],

  tags: [
    { name: 'queue-entry', description: 'Customer-facing queue ticket operations' },
    { name: 'queues', description: 'Admin queue management' },
    { name: 'notifications', description: 'Notification history' },
    { name: 'line', description: 'LINE Messaging API webhook' },
    { name: 'health', description: 'Health and liveness probes' },
  ],

  paths: {
    ...queueEntryPaths,
    ...queuesAdminPaths,
    ...notificationsPaths,
    ...linePaths,

    '/health': {
      get: {
        tags: ['health'],
        summary: 'Liveness probe',
        operationId: 'healthCheck',
        responses: {
          200: {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      ...commonSchemas,
      ...queueEntrySchemas,
      ...notificationSchemas,
      ...adminQueueSchemas,
    },

    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token issued upon login.',
      },
    },

    responses: {
      ValidationError: {
        description: 'Request body / query / params failed Zod validation (422)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: {
                  formErrors: [],
                  fieldErrors: { queueId: ['Must be a valid UUID'] },
                },
              },
            },
          },
        },
      },

      Unauthorized: {
        description: 'Missing or invalid authentication token (401)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            },
          },
        },
      },

      Forbidden: {
        description: 'Authenticated but not authorised to perform this action (403)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },

      NotFound: {
        description: 'Resource not found (404)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Resource not found' },
            },
          },
        },
      },

      BadRequest: {
        description: 'Generic bad request (400)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },

      Conflict: {
        description: 'State conflict — e.g. user already has an active ticket (409)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'CONFLICT',
                message: 'User already has an active ticket in this queue',
              },
            },
          },
        },
      },
    },
  },
} as const;
