export const paymentSchemas = {
  PaymentState: {
    type: 'string',
    enum: ['pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded'],
  },

  CreatePaymentIntentRequest: {
    type: 'object',
    required: ['orgSlug', 'items', 'scope'],
    properties: {
      orgSlug: { type: 'string', example: 'demo-queue-lab-2026' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1, maximum: 99 },
          },
        },
      },
      scope: { type: 'string', enum: ['required_items', 'all_items'] },
      provider: { type: 'string', enum: ['demo', 'stripe', 'komoju', 'paypay'], default: 'demo' },
      method: { type: 'string', example: 'credit_card' },
      currency: { type: 'string', example: 'JPY' },
      returnUrl: { type: 'string', format: 'uri' },
      cartSignature: { type: 'string' },
    },
  },

  PaymentIntentResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', format: 'uuid' },
          provider: { type: 'string', example: 'demo' },
          method: { type: 'string', example: 'credit_card' },
          status: { $ref: '#/components/schemas/PaymentState' },
          amount: { type: 'number', example: 1500 },
          currency: { type: 'string', example: 'JPY' },
          checkoutUrl: { type: 'string', nullable: true },
          demoToken: { type: 'string', nullable: true },
          coveredProductIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          scope: { type: 'string', enum: ['required_items', 'all_items'] },
        },
      },
    },
  },

  CompleteDemoPaymentRequest: {
    type: 'object',
    required: ['transactionId', 'demoToken'],
    properties: {
      transactionId: { type: 'string', format: 'uuid' },
      demoToken: { type: 'string' },
    },
  },

  PaymentTransactionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          provider: { type: 'string', example: 'demo' },
          method: { type: 'string', example: 'credit_card' },
          status: { $ref: '#/components/schemas/PaymentState' },
          amount: { type: 'number', example: 1500 },
          currency: { type: 'string', example: 'JPY' },
          checkoutUrl: { type: 'string', nullable: true },
          returnUrl: { type: 'string', nullable: true },
          scope: { type: 'string', enum: ['required_items', 'all_items'] },
          coveredProductIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          paidAt: { type: 'string', format: 'date-time', nullable: true },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;
