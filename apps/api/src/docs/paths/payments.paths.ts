export const paymentsPaths = {
  '/api/v1/payments/intents': {
    post: {
      tags: ['payments'],
      summary: 'Create a server-side payment intent',
      operationId: 'createPaymentIntent',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreatePaymentIntentRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Payment intent created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentIntentResponse' },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        409: { $ref: '#/components/responses/Conflict' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/payments/demo/complete': {
    post: {
      tags: ['payments'],
      summary: 'Complete a demo payment with a server-issued token',
      operationId: 'completeDemoPayment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CompleteDemoPaymentRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Payment transaction after server-side demo verification',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentTransactionResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        422: { $ref: '#/components/responses/ValidationError' },
      },
    },
  },

  '/api/v1/payments/{transactionId}/return': {
    get: {
      tags: ['payments'],
      summary: 'Read payment return status after provider redirect',
      operationId: 'getPaymentReturnStatus',
      parameters: [
        {
          name: 'transactionId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        200: {
          description: 'Current verified payment transaction state',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentTransactionResponse' },
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/v1/payments/{transactionId}/reconcile': {
    post: {
      tags: ['payments'],
      summary: 'Reconcile a verified payment transaction with linked order records',
      operationId: 'reconcilePayment',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'transactionId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        200: {
          description: 'Reconciled payment transaction',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaymentTransactionResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/api/v1/payments/webhooks/{provider}': {
    post: {
      tags: ['payments'],
      summary: 'Receive signed provider payment webhook',
      operationId: 'handlePaymentWebhook',
      parameters: [
        {
          name: 'provider',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['demo', 'stripe', 'komoju', 'paypay'] },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      },
      responses: {
        200: {
          description: 'Webhook accepted idempotently',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      received: { type: 'boolean', example: true },
                      duplicate: { type: 'boolean', example: false },
                    },
                  },
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
