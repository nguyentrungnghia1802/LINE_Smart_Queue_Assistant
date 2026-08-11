export const adminOperationsPaths = {
  '/api/v1/admin/operations/health': {
    get: {
      tags: ['admin'],
      summary: 'Read sanitized platform operational health',
      operationId: 'getAdminOperationalHealth',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description:
            'Platform infrastructure, delivery aggregates, runtime mode, and safe indicators',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data'],
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: {
                    type: 'object',
                    required: [
                      'status',
                      'checkedAt',
                      'environment',
                      'release',
                      'components',
                      'notifications',
                      'indicators',
                    ],
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['healthy', 'degraded', 'unavailable'],
                      },
                      checkedAt: { type: 'string', format: 'date-time' },
                      environment: { type: 'string' },
                      release: { type: 'string' },
                      uptimeSeconds: { type: 'integer', minimum: 0 },
                      components: {
                        type: 'object',
                        description:
                          'Safe API, PostgreSQL, Redis, worker, realtime, LINE, and payment states',
                        additionalProperties: {
                          type: 'object',
                          properties: {
                            status: {
                              type: 'string',
                              enum: [
                                'healthy',
                                'degraded',
                                'unavailable',
                                'not_configured',
                                'not_applicable',
                              ],
                            },
                            reasonCode: { type: 'string' },
                          },
                        },
                      },
                      notifications: {
                        type: 'object',
                        description:
                          'Cross-tenant aggregate counts only; no notification or customer records',
                      },
                      indicators: {
                        type: 'object',
                        description: 'Process-local request, error, latency, and pool indicators',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
} as const;
