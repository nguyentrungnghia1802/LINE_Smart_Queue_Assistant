import fs from 'node:fs';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';

import { apiEndpointCatalog } from '../api-endpoint-catalog';
import { swaggerSpec } from '../swagger';

const routeModules = [
  ['auth/auth.routes.ts', '/auth'],
  ['admin/admin.routes.ts', '/admin'],
  ['bookings/booking-groups.routes.ts', '/booking-groups'],
  ['forecasts/forecasts.routes.ts', '/forecasts'],
  ['line/line.routes.ts', '/line'],
  ['media/media.routes.ts', '/media'],
  ['notifications/notifications.routes.ts', '/notifications'],
  ['orders/orders.routes.ts', '/orders'],
  ['orgs/orgs.routes.ts', '/orgs'],
  ['payments/payments.routes.ts', '/payments'],
  ['products/products.routes.ts', '/products'],
  ['queue/queue.routes.ts', '/queue'],
  ['queues/queues.routes.ts', '/queues'],
  ['staff/staff.routes.ts', '/staff'],
  ['users/users.routes.ts', '/users'],
] as const;

function normalizeExpressPath(prefix: string, route: string) {
  const joined = `/api/v1${prefix}${route === '/' ? '' : route}`;
  return joined.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function runtimeOperations() {
  const operations = new Set<string>();
  for (const [relativeFile, prefix] of routeModules) {
    const source = fs.readFileSync(
      path.resolve(__dirname, `../../modules/${relativeFile}`),
      'utf8'
    );
    const matches = source.matchAll(/\w+Router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g);
    for (const match of matches) {
      operations.add(`${match[1]} ${normalizeExpressPath(prefix, match[2])}`);
    }
  }
  return operations;
}

function catalogOperations() {
  return new Set(apiEndpointCatalog.map((entry) => `${entry.method} ${entry.path}`));
}

describe('OpenAPI runtime contract', () => {
  it('contains exactly every mounted /api/v1 router operation', () => {
    expect([...catalogOperations()].sort()).toEqual([...runtimeOperations()].sort());
  });

  it('publishes every catalog operation in the assembled specification', () => {
    for (const entry of apiEndpointCatalog) {
      const pathItem = swaggerSpec.paths[entry.path as keyof typeof swaggerSpec.paths] as
        | Record<string, unknown>
        | undefined;
      expect(pathItem).toBeDefined();
      expect(pathItem?.[entry.method]).toBeDefined();
    }
  });

  it('records auth, pagination, and runtime validator metadata in the catalog', () => {
    const history = apiEndpointCatalog.find((entry) => entry.path === '/api/v1/booking-groups/me');
    const webhook = apiEndpointCatalog.find((entry) => entry.path === '/api/v1/line/webhook');
    const payment = apiEndpointCatalog.find((entry) => entry.path === '/api/v1/payments/intents');
    expect(history).toMatchObject({
      auth: true,
      pagination: true,
      validator: 'BookingGroupListQuerySchema',
    });
    expect(webhook).toMatchObject({ auth: false, validator: 'LineWebhookSignature' });
    expect(payment).toMatchObject({ auth: false, validator: 'CreatePaymentIntentSchema' });
  });

  it('is a valid OpenAPI 3 document', async () => {
    await expect(SwaggerParser.validate(swaggerSpec as never)).resolves.toBeDefined();
  });
});
