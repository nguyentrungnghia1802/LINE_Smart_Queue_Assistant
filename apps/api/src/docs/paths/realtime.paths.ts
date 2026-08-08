const bearerSecurity = [{ BearerAuth: [] }];

function sseOperation(input: {
  summary: string;
  operationId: string;
  parameterName: 'entryId' | 'queueId';
  description: string;
}) {
  return {
    tags: ['realtime'],
    summary: input.summary,
    operationId: input.operationId,
    security: bearerSecurity,
    parameters: [
      {
        name: input.parameterName,
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        name: 'Last-Event-ID',
        in: 'header',
        required: false,
        schema: { type: 'string', format: 'uuid' },
        description: 'Reconnect hint only; clients must recover authoritative state through REST.',
      },
    ],
    responses: {
      200: {
        description: input.description,
        headers: {
          'Cache-Control': { schema: { type: 'string', example: 'no-cache, no-transform' } },
          'X-Accel-Buffering': { schema: { type: 'string', example: 'no' } },
        },
        content: {
          'text/event-stream': {
            schema: { type: 'string', example: 'event: ticket.called\ndata: {...}\n\n' },
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthorized' },
      403: { $ref: '#/components/responses/Forbidden' },
      404: { $ref: '#/components/responses/NotFound' },
      422: { $ref: '#/components/responses/ValidationError' },
      429: { description: 'Global or per-account SSE connection limit reached' },
    },
    'x-runtime-validator':
      input.parameterName === 'entryId'
        ? 'RealtimeTicketParamsSchema'
        : 'RealtimeQueueParamsSchema',
  };
}

export const realtimePaths = {
  '/api/v1/realtime/tickets/{entryId}': {
    get: sseOperation({
      summary: 'Stream transient updates for a customer-owned ticket',
      operationId: 'streamCustomerTicket',
      parameterName: 'entryId',
      description:
        'Authorized versioned ticket events. PostgreSQL-backed REST remains authoritative.',
    }),
  },
  '/api/v1/realtime/queues/{queueId}': {
    get: sseOperation({
      summary: 'Stream transient updates for an assigned branch queue',
      operationId: 'streamBranchQueue',
      parameterName: 'queueId',
      description: 'Authorized versioned queue events for branch managers and assigned staff.',
    }),
  },
} as const;
