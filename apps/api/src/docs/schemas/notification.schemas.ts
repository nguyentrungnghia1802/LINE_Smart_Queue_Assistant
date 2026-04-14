/**
 * OpenAPI schemas for notification domain.
 * Mirror packages/shared/src/types/entities.ts — Notification, NotificationPayload.
 */
export const notificationSchemas = {
  NotificationPayload: {
    type: 'object',
    required: ['title', 'body'],
    properties: {
      title: { type: 'string', maxLength: 60 },
      body: { type: 'string', maxLength: 400 },
      data: {
        type: 'object',
        additionalProperties: true,
        description: 'Arbitrary key-value pairs for template rendering',
      },
    },
  },

  NotificationResponse: {
    allOf: [
      { $ref: '#/components/schemas/BaseEntity' },
      {
        type: 'object',
        required: ['type', 'channel', 'status', 'payload', 'retryCount'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'TICKET_ISSUED',
              'TURN_APPROACHING',
              'TURN_NOW',
              'TICKET_EXPIRED',
              'QUEUE_PAUSED',
              'QUEUE_RESUMED',
              'QUEUE_CLOSED',
            ],
          },
          channel: { type: 'string', enum: ['LINE', 'EMAIL', 'PUSH'] },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] },
          payload: { $ref: '#/components/schemas/NotificationPayload' },
          ticketId: { type: 'string', format: 'uuid', nullable: true },
          queueId: { type: 'string', format: 'uuid', nullable: true },
          sentAt: { type: 'string', format: 'date-time', nullable: true },
          retryCount: { type: 'integer', example: 0 },
        },
      },
    ],
  },
} as const;
