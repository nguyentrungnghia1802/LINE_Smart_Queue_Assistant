/**
 * OpenAPI path definitions for LINE Messaging platform integration.
 * Base path: /api/v1/line
 *
 * Signature verification is handled inside the controller using
 * the X-Line-Signature header per LINE's webhook spec.
 */
export const linePaths = {
  '/api/v1/line/webhook': {
    post: {
      tags: ['line'],
      summary: 'Receive LINE Messaging API webhook events',
      operationId: 'lineWebhook',
      description:
        'The LINE platform calls this endpoint for every event (message, follow, unfollow, …). ' +
        'The controller validates the `X-Line-Signature` header before processing.',
      parameters: [
        {
          name: 'X-Line-Signature',
          in: 'header',
          required: true,
          schema: { type: 'string' },
          description:
            'HMAC-SHA256 signature of the request body, base64-encoded. ' +
            "Signed with the channel's secret.",
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['destination', 'events'],
              properties: {
                destination: {
                  type: 'string',
                  description: 'LINE user ID of the bot',
                  example: 'Udeadbeef...',
                },
                events: {
                  type: 'array',
                  description: 'Array of LINE webhook event objects',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', example: 'message' },
                      timestamp: { type: 'integer', example: 1617900000000 },
                      source: {
                        type: 'object',
                        properties: {
                          type: { type: 'string', example: 'user' },
                          userId: { type: 'string', example: 'Udeadbeef...' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Webhook accepted (LINE requires 200 even on partial failure)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success'],
                properties: {
                  success: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        401: {
          description: 'Invalid LINE signature',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        429: { description: 'Rate limit exceeded' },
      },
    },
  },
} as const;
