/**
 * OpenAPI schemas for customer-facing queue entry operations.
 *
 * Corresponds to POST /api/v1/queue/* endpoints.
 * Domain types mirror packages/shared/src/types/entities.ts.
 */
export const queueEntrySchemas = {
  // ── Request bodies ───────────────────────────────────────────────────────────

  JoinQueueRequest: {
    type: 'object',
    required: ['queueId'],
    properties: {
      queueId: {
        type: 'string',
        format: 'uuid',
        description: 'Target queue ID',
      },
      lineUserId: {
        type: 'string',
        maxLength: 60,
        description: 'LINE user ID — enables push notifications for this ticket',
      },
      notes: {
        type: 'string',
        maxLength: 500,
        description: 'Optional customer-provided notes (dietary requirements, etc.)',
      },
    },
  },

  // ── Response shapes ──────────────────────────────────────────────────────────

  TicketResponse: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        required: ['number', 'displayCode', 'status', 'queueId', 'positionInQueue'],
        properties: {
          number: {
            type: 'integer',
            example: 7,
            description: 'Monotonically increasing queue number',
          },
          displayCode: {
            type: 'string',
            example: 'A007',
            description: 'Formatted code shown to customer: prefix + zero-padded number',
          },
          status: {
            type: 'string',
            enum: ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
          },
          queueId: { type: 'string', format: 'uuid' },
          positionInQueue: { type: 'integer', example: 3 },
          estimatedWaitMinutes: { type: 'integer', example: 15, nullable: true },
          estimatedCallTime: { type: 'string', format: 'date-time', nullable: true },
          calledAt: { type: 'string', format: 'date-time', nullable: true },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    ],
  },

  QueueStatusResponse: {
    type: 'object',
    required: ['queueId', 'name', 'status', 'currentNumber', 'waitingCount'],
    properties: {
      queueId: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'General Service' },
      status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'CLOSED'] },
      currentNumber: { type: 'integer', example: 12 },
      waitingCount: { type: 'integer', example: 8 },
      servingCount: { type: 'integer', example: 1 },
      avgServiceTimeMinutes: { type: 'integer', example: 5, nullable: true },
      ticketPrefix: { type: 'string', example: 'A', nullable: true },
    },
  },
} as const;
