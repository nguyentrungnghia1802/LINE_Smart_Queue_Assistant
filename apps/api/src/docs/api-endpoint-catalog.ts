export type ApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ApiEndpointDefinition {
  method: ApiMethod;
  path: string;
  tag: string;
  auth: boolean;
  validator?: string;
  pagination?: boolean;
}

const endpoint = (
  method: ApiMethod,
  path: string,
  tag: string,
  options: Partial<Pick<ApiEndpointDefinition, 'auth' | 'validator' | 'pagination'>> = {}
): ApiEndpointDefinition => ({ method, path, tag, auth: true, ...options });

export const apiEndpointCatalog: ApiEndpointDefinition[] = [
  endpoint('post', '/api/v1/auth/line', 'auth', { auth: false, validator: 'LineLoginSchema' }),
  endpoint('post', '/api/v1/auth/login', 'auth', {
    auth: false,
    validator: 'EmailPasswordLoginSchema',
  }),
  endpoint('post', '/api/v1/auth/register', 'auth', {
    auth: false,
    validator: 'RegisterCustomerSchema',
  }),

  endpoint('get', '/api/v1/admin/organizations', 'admin'),
  endpoint('post', '/api/v1/admin/organizations', 'admin', {
    validator: 'CreateOrganizationSchema',
  }),
  endpoint('post', '/api/v1/admin/organizations/register', 'admin', {
    validator: 'CreateOrganizationRegistrationSchema',
  }),
  endpoint('patch', '/api/v1/admin/organizations/{orgId}', 'admin', {
    validator: 'UpdateOrganizationSchema',
  }),
  endpoint('delete', '/api/v1/admin/organizations/{orgId}', 'admin'),
  endpoint('get', '/api/v1/admin/organizations/{orgId}/managers', 'admin'),
  endpoint('post', '/api/v1/admin/organizations/{orgId}/managers', 'admin', {
    validator: 'CreateManagerSchema',
  }),
  endpoint('patch', '/api/v1/admin/organizations/{orgId}/managers/{userId}', 'admin', {
    validator: 'UpdateManagerSchema',
  }),
  endpoint('delete', '/api/v1/admin/organizations/{orgId}/managers/{userId}', 'admin'),

  endpoint('get', '/api/v1/booking-groups/me', 'bookings', {
    pagination: true,
    validator: 'BookingGroupListQuerySchema',
  }),
  endpoint('get', '/api/v1/booking-groups/{id}', 'bookings', {
    validator: 'BookingGroupParamsSchema',
  }),
  endpoint('get', '/api/v1/forecasts/wait', 'forecasts'),
  endpoint('get', '/api/v1/forecasts/staffing', 'forecasts'),

  endpoint('get', '/api/v1/line/preferences', 'line'),
  endpoint('put', '/api/v1/line/preferences', 'line', {
    validator: 'UpdateNotificationPreferencesSchema',
  }),
  endpoint('get', '/api/v1/line/location-consent', 'location'),
  endpoint('put', '/api/v1/line/location-consent', 'location', {
    validator: 'UpdateLocationConsentSchema',
  }),
  endpoint('delete', '/api/v1/line/location-data', 'location'),
  endpoint('post', '/api/v1/line/webhook', 'line', {
    auth: false,
    validator: 'LineWebhookSignature',
  }),

  endpoint('post', '/api/v1/media', 'media', { validator: 'UploadMediaSchema' }),
  endpoint('delete', '/api/v1/media/{id}', 'media', { validator: 'MediaParamsSchema' }),

  endpoint('get', '/api/v1/notifications/operations', 'notifications', {
    pagination: true,
    validator: 'ListNotificationOperationsQuerySchema',
  }),
  endpoint('post', '/api/v1/notifications/operations/{id}/retry', 'notifications', {
    validator: 'NotificationOperationBodySchema',
  }),
  endpoint('post', '/api/v1/notifications/operations/{id}/cancel', 'notifications', {
    validator: 'NotificationOperationBodySchema',
  }),
  endpoint('get', '/api/v1/notifications', 'notifications', {
    pagination: true,
    validator: 'ListNotificationsQuerySchema',
  }),

  endpoint('post', '/api/v1/orders', 'orders', { auth: false, validator: 'CreateOrderSchema' }),
  endpoint('post', '/api/v1/orders/{id}/cancel', 'orders'),
  endpoint('get', '/api/v1/orders', 'orders'),
  endpoint('get', '/api/v1/orders/stats', 'orders'),
  endpoint('get', '/api/v1/orders/{id}/receipt', 'orders'),
  endpoint('get', '/api/v1/orders/{id}', 'orders'),
  endpoint('patch', '/api/v1/orders/{id}/status', 'orders', {
    validator: 'UpdateOrderStatusSchema',
  }),
  endpoint('patch', '/api/v1/orders/{id}/payment', 'payments', {
    validator: 'UpdateOrderPaymentSchema',
  }),

  endpoint('get', '/api/v1/orgs/my-org', 'organizations'),
  endpoint('patch', '/api/v1/orgs/my-org', 'organizations', {
    validator: 'UpdateOrgSettingsSchema',
  }),
  endpoint('get', '/api/v1/orgs/my-org/business-calendar', 'organizations'),
  endpoint('put', '/api/v1/orgs/my-org/business-calendar', 'organizations', {
    validator: 'BusinessCalendarSchema',
  }),
  endpoint('get', '/api/v1/orgs/by-token/{token}', 'organizations', { auth: false }),
  endpoint('get', '/api/v1/orgs/{slug}', 'organizations', { auth: false }),

  endpoint('post', '/api/v1/payments/intents', 'payments', {
    auth: false,
    validator: 'CreatePaymentIntentSchema',
  }),
  endpoint('post', '/api/v1/payments/demo/complete', 'payments', {
    auth: false,
    validator: 'CompleteDemoPaymentSchema',
  }),
  endpoint('get', '/api/v1/payments/{transactionId}/return', 'payments', {
    auth: false,
    validator: 'PaymentTransactionParamSchema',
  }),
  endpoint('post', '/api/v1/payments/{transactionId}/reconcile', 'payments', {
    validator: 'PaymentTransactionParamSchema',
  }),
  endpoint('post', '/api/v1/payments/webhooks/{provider}', 'payments', {
    auth: false,
    validator: 'PaymentProviderParamSchema',
  }),

  endpoint('get', '/api/v1/products', 'products', { auth: false }),
  endpoint('get', '/api/v1/products/{id}', 'products', { auth: false }),
  endpoint('post', '/api/v1/products', 'products', { validator: 'CreateProductSchema' }),
  endpoint('patch', '/api/v1/products/{id}', 'products', { validator: 'UpdateProductSchema' }),
  endpoint('delete', '/api/v1/products/{id}', 'products'),

  endpoint('post', '/api/v1/queue/join', 'queue-entry', {
    auth: false,
    validator: 'JoinQueueSchema',
  }),
  endpoint('get', '/api/v1/queue/current', 'queue-entry', {
    auth: false,
    validator: 'CurrentQueueQuerySchema',
  }),
  endpoint('get', '/api/v1/queue/me', 'queue-entry'),
  endpoint('get', '/api/v1/queue/me/penalties', 'queue-entry'),
  endpoint('get', '/api/v1/queue/entry/{entryId}', 'queue-entry', {
    auth: false,
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/queue/{entryId}/cancel', 'queue-entry', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/queue/{entryId}/skip', 'queue-entry', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/queue/{entryId}/serve', 'queue-entry', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/queue/{entryId}/complete', 'queue-entry', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('get', '/api/v1/queue/{queueId}/status', 'queue-entry', {
    auth: false,
    validator: 'QueueIdParamSchema',
  }),
  endpoint('post', '/api/v1/queue/{queueId}/call-next', 'queue-entry', {
    validator: 'QueueIdParamSchema',
  }),

  endpoint('get', '/api/v1/queues', 'queues'),
  endpoint('get', '/api/v1/queues/{id}', 'queues', { validator: 'UUIDParamSchema' }),
  endpoint('post', '/api/v1/queues', 'queues', { validator: 'CreateQueueSchema' }),
  endpoint('patch', '/api/v1/queues/{id}', 'queues', { validator: 'UpdateQueueSchema' }),
  endpoint('patch', '/api/v1/queues/{id}/status', 'queues', {
    validator: 'UpdateQueueStatusSchema',
  }),
  endpoint('delete', '/api/v1/queues/{id}', 'queues', { validator: 'UUIDParamSchema' }),

  endpoint('get', '/api/v1/staff/my-queue', 'staff'),
  endpoint('get', '/api/v1/staff/queues/{queueId}', 'staff', { validator: 'QueueIdParamSchema' }),
  endpoint('post', '/api/v1/staff/queues/{queueId}/call-next', 'staff', {
    validator: 'QueueIdParamSchema',
  }),
  endpoint('post', '/api/v1/staff/entries/{entryId}/serve', 'staff', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/staff/entries/{entryId}/complete', 'staff', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/staff/entries/{entryId}/no-show', 'staff', {
    validator: 'EntryIdParamSchema',
  }),
  endpoint('post', '/api/v1/staff/entries/{entryId}/cancel', 'staff', {
    validator: 'EntryIdParamSchema',
  }),

  endpoint('get', '/api/v1/users', 'users'),
  endpoint('patch', '/api/v1/users/me', 'users', { validator: 'UpdateMyProfileSchema' }),
  endpoint('post', '/api/v1/users/staff', 'users'),
  endpoint('patch', '/api/v1/users/staff/{userId}/status', 'users'),
  endpoint('patch', '/api/v1/users/staff/{userId}', 'users'),
  endpoint('delete', '/api/v1/users/staff/{userId}', 'users'),
  endpoint('get', '/api/v1/users/{id}', 'users', { validator: 'UUIDParamSchema' }),
  endpoint('post', '/api/v1/users', 'users', { validator: 'CreateUserSchema' }),
  endpoint('delete', '/api/v1/users/{id}', 'users', { validator: 'UUIDParamSchema' }),
];

function pathParameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

export function buildCatalogPaths() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const definition of apiEndpointCatalog) {
    const parameters: Array<Record<string, unknown>> = pathParameters(definition.path);
    if (definition.pagination) {
      parameters.push(
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        }
      );
    }
    const isWrite = ['post', 'put', 'patch'].includes(definition.method);
    paths[definition.path] ??= {};
    paths[definition.path][definition.method] = {
      tags: [definition.tag],
      summary: `${definition.method.toUpperCase()} ${definition.path}`,
      operationId: `${definition.method}_${definition.path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      security: definition.auth ? [{ BearerAuth: [] }] : [],
      parameters,
      ...(isWrite && definition.path !== '/api/v1/line/webhook'
        ? {
            requestBody: {
              required: false,
              content: {
                'application/json': { schema: { type: 'object', additionalProperties: true } },
              },
            },
          }
        : {}),
      responses: {
        [definition.method === 'post' ? '201' : '200']: {
          description: 'Successful response using the standard success envelope',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        '404': { $ref: '#/components/responses/NotFound' },
        '409': { $ref: '#/components/responses/Conflict' },
        '422': { $ref: '#/components/responses/ValidationError' },
      },
      'x-runtime-validator': definition.validator ?? null,
    };
  }
  return paths;
}
