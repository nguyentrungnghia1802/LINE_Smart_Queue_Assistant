/**
 * OpenAPI schemas for notification domain.
 * Mirror packages/shared/src/types/entities.ts — Notification, NotificationPayload.
 */
export const notificationSchemas = {
  NotificationOperationSummary: {
    type: 'object',
    required: [
      'id',
      'eventType',
      'locale',
      'status',
      'attemptCount',
      'maxAttempts',
      'manualRetryCount',
      'canRetry',
      'canCancel',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      organizationId: { type: 'string', format: 'uuid', nullable: true },
      organizationName: { type: 'string', nullable: true },
      branchId: { type: 'string', format: 'uuid', nullable: true },
      branchName: { type: 'string', nullable: true },
      queueEntryId: { type: 'string', format: 'uuid', nullable: true },
      queueName: { type: 'string', nullable: true },
      ticketCode: { type: 'string', nullable: true },
      ticketStatus: { type: 'string', nullable: true },
      eventType: { type: 'string' },
      locale: { type: 'string', enum: ['ja', 'vi', 'en'] },
      status: { type: 'string', enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'] },
      attemptCount: { type: 'integer', minimum: 0 },
      maxAttempts: { type: 'integer', minimum: 1 },
      manualRetryCount: { type: 'integer', minimum: 0 },
      failureCategory: {
        type: 'string',
        nullable: true,
        enum: [
          'blocked_recipient',
          'invalid_recipient',
          'timeout',
          'rate_limited',
          'provider_4xx',
          'provider_5xx',
          'network',
          'unknown',
        ],
      },
      canRetry: { type: 'boolean' },
      canCancel: { type: 'boolean' },
      lineRecipient: { type: 'string', nullable: true, description: 'Masked LINE recipient ID' },
      nextRetryAt: { type: 'string', format: 'date-time', nullable: true },
      sentAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  NotificationOperationDetail: {
    allOf: [
      { $ref: '#/components/schemas/NotificationOperationSummary' },
      {
        type: 'object',
        required: ['eventKey', 'dispatchStatus'],
        properties: {
          eventKey: { type: 'string' },
          dispatchStatus: { type: 'string', enum: ['pending', 'dispatching', 'dispatched'] },
          dispatchedAt: { type: 'string', format: 'date-time', nullable: true },
          processingStartedAt: { type: 'string', format: 'date-time', nullable: true },
          sanitizedLastError: { type: 'string', nullable: true, maxLength: 300 },
          operatorNote: { type: 'string', nullable: true, maxLength: 500 },
        },
      },
    ],
  },

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
        required: ['type', 'channel', 'status', 'payload', 'retryCount', 'locale'],
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
          locale: { type: 'string', enum: ['ja', 'vi', 'en'], default: 'ja' },
        },
      },
    ],
  },
} as const;
