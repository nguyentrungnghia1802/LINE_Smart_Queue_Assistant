import { EventEmitter } from 'node:events';

import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import type { QueueEntryRow } from '../../../db/repositories/queue-entries.repository';
import type { QueueRow } from '../../../db/repositories/queues.repository';
import type { AuthUser } from '../../../types/auth.types';
import type { RealtimeEvent } from '../realtime.contract';
import type { RealtimeHub } from '../realtime.hub';
import { RealtimeService } from '../realtime.service';

const customerId = '11111111-1111-4111-8111-111111111111';
const otherCustomerId = '99999999-9999-4999-8999-999999999999';
const organizationId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const queueId = '44444444-4444-4444-8444-444444444444';
const entryId = '55555555-5555-4555-8555-555555555555';

const queue: QueueRow = {
  id: queueId,
  organization_id: organizationId,
  branch_id: branchId,
  name: 'Queue A',
  description: null,
  status: 'open',
  queue_type: 'standard',
  prefix: 'A',
  max_capacity: null,
  daily_ticket_counter: 1,
  last_counter_reset_at: new Date('2026-08-08T00:00:00.000Z'),
  avg_service_seconds: 300,
  notify_ahead_positions: 5,
  allow_skip: true,
  max_skips_before_penalty: 3,
  opens_at: null,
  closes_at: null,
  settings: {},
  is_active: true,
  created_at: new Date('2026-08-08T00:00:00.000Z'),
  updated_at: new Date('2026-08-08T00:00:00.000Z'),
};

const entry: QueueEntryRow = {
  id: entryId,
  queue_id: queueId,
  user_id: customerId,
  order_id: null,
  line_user_id: 'U-line-customer',
  ticket_number: 1,
  ticket_code: 'A001',
  status: 'waiting',
  priority: 0,
  position_snapshot: 0,
  estimated_wait_seconds: 300,
  called_at: null,
  serving_started_at: null,
  served_at: null,
  skipped_at: null,
  cancelled_at: null,
  no_show_at: null,
  created_at: new Date('2026-08-08T00:00:00.000Z'),
  updated_at: new Date('2026-08-08T00:00:00.000Z'),
};

function actor(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: customerId, role: UserRole.CUSTOMER, ...overrides };
}

function createService(options?: {
  foundEntry?: QueueEntryRow | null;
  foundQueue?: QueueRow | null;
  subscribe?: jest.Mock;
}) {
  const release = jest.fn(async () => undefined);
  const subscribe = options?.subscribe ?? jest.fn(async () => release);
  const hub = {
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    subscribe,
    ticketChannel: jest.fn(() => 'ticket-channel'),
    queueChannel: jest.fn(() => 'queue-channel'),
    publish: jest.fn(async () => undefined),
  } as unknown as RealtimeHub;
  const service = new RealtimeService(
    hub,
    { findById: jest.fn(async () => options?.foundEntry ?? entry) },
    { findById: jest.fn(async () => options?.foundQueue ?? queue) },
    { keepAliveMs: 1_000, retryMs: 3_000, maxConnectionDurationMs: 5_000 }
  );
  return { service, hub, subscribe, release };
}

describe('RealtimeService authorization', () => {
  it('allows a customer to subscribe to their own ticket', async () => {
    const { service } = createService();

    await expect(service.authorizeTicket(actor(), entryId)).resolves.toMatchObject({
      organizationId,
      branchId,
      queueId,
      ticketId: entryId,
    });
  });

  it('rejects a foreign customer and a business role on the customer stream', async () => {
    const { service } = createService();

    await expect(
      service.authorizeTicket(actor({ id: otherCustomerId, lineUserId: 'U-other' }), entryId)
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.authorizeTicket(
        actor({
          role: UserRole.MANAGER,
          organizationId,
          branchIds: [branchId],
        }),
        entryId
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows the exact branch operator and rejects foreign branch and owner access', async () => {
    const { service } = createService();
    const manager = actor({
      role: UserRole.MANAGER,
      organizationId,
      branchIds: [branchId],
      isOrganizationOwner: false,
    });

    await expect(service.authorizeQueue(manager, queueId)).resolves.toMatchObject({ queueId });
    await expect(
      service.authorizeQueue(
        { ...manager, branchIds: ['66666666-6666-4666-8666-666666666666'] },
        queueId
      )
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.authorizeQueue({ ...manager, isOrganizationOwner: true }, queueId)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('restricts staff to their assigned queue', async () => {
    const { service } = createService();
    const staff = actor({
      role: UserRole.STAFF,
      organizationId,
      branchIds: [branchId],
      assignedQueueId: '77777777-7777-4777-8777-777777777777',
    });

    await expect(service.authorizeQueue(staff, queueId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('RealtimeService stream lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sets SSE headers, emits keep-alive, and releases on disconnect', async () => {
    const { service, subscribe, release } = createService();
    const req = new EventEmitter() as EventEmitter & Request;
    req.get = jest.fn(() => undefined) as Request['get'];
    const writes: string[] = [];
    const headers = new Map<string, string>();
    const res = new EventEmitter() as EventEmitter & Response;
    Object.assign(res, {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      status: jest.fn(() => res),
      setHeader: jest.fn((name: string, value: string) => headers.set(name, value)),
      flushHeaders: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
        return true;
      }),
      end: jest.fn(() => {
        Object.defineProperty(res, 'writableEnded', { value: true, configurable: true });
      }),
    });

    await service.openTicketStream(req, res, actor(), entryId);
    expect(headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(headers.get('X-Accel-Buffering')).toBe('no');
    expect(writes[0]).toContain('retry: 3000');

    jest.advanceTimersByTime(1_000);
    expect(writes.some((chunk) => chunk.startsWith(': keep-alive'))).toBe(true);

    const subscription = subscribe.mock.calls[0][0] as {
      accepts: (event: RealtimeEvent) => boolean;
      onEvent: (event: RealtimeEvent) => void;
    };
    const ownEvent: RealtimeEvent = {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'ticket.called',
      version: 1,
      occurredAt: '2026-08-08T00:00:00.000Z',
      scope: { organizationId, branchId, queueId, ticketId: entryId },
      payload: { status: 'called' },
    };
    expect(subscription.accepts(ownEvent)).toBe(true);
    subscription.onEvent(ownEvent);
    expect(writes.at(-1)).toContain('event: ticket.called');

    const foreignEvent: RealtimeEvent = {
      id: '99999999-9999-4999-8999-999999999998',
      name: 'ticket.called',
      version: 1,
      occurredAt: '2026-08-08T00:00:01.000Z',
      scope: {
        organizationId,
        branchId,
        queueId,
        ticketId: '99999999-9999-4999-8999-999999999997',
      },
      payload: { status: 'called' },
    };
    expect(subscription.accepts(foreignEvent)).toBe(false);

    req.emit('close');
    await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
