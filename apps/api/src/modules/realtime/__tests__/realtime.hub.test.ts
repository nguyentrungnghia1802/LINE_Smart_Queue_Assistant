import { createRealtimeEvent, type RealtimeEvent } from '../realtime.contract';
import { RealtimeHub } from '../realtime.hub';
import type { RealtimeMessageHandler, RealtimePubSubTransport } from '../realtime.pubsub';

class SharedBroker {
  private readonly handlers = new Map<string, Set<RealtimeMessageHandler>>();

  subscribe(channel: string, handler: RealtimeMessageHandler): () => void {
    const handlers = this.handlers.get(channel) ?? new Set<RealtimeMessageHandler>();
    handlers.add(handler);
    this.handlers.set(channel, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.handlers.delete(channel);
    };
  }

  publish(channels: string[], event: RealtimeEvent): void {
    for (const channel of channels) {
      for (const handler of this.handlers.get(channel) ?? []) handler(event);
    }
  }
}

class BrokerTransport implements RealtimePubSubTransport {
  readonly enabled = true;

  constructor(private readonly broker: SharedBroker) {}

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async publish(channels: string[], event: RealtimeEvent): Promise<void> {
    this.broker.publish(channels, event);
  }

  async subscribe(channel: string, handler: RealtimeMessageHandler): Promise<() => Promise<void>> {
    const release = this.broker.subscribe(channel, handler);
    return async () => release();
  }
}

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '99999999-9999-4999-8999-999999999999';
const branch = '22222222-2222-4222-8222-222222222222';
const queue = '33333333-3333-4333-8333-333333333333';
const ticket = '44444444-4444-4444-8444-444444444444';

function hub(transport: RealtimePubSubTransport): RealtimeHub {
  return new RealtimeHub(transport, {
    keyPrefix: 'sqa',
    maxConnections: 20,
    maxConnectionsPerUser: 3,
  });
}

describe('RealtimeHub', () => {
  it('fans out across API instances, avoids sender duplicates, and isolates tenants', async () => {
    const broker = new SharedBroker();
    const first = hub(new BrokerTransport(broker));
    const second = hub(new BrokerTransport(broker));
    await first.start();
    await second.start();

    const firstEvents: RealtimeEvent[] = [];
    const secondEvents: RealtimeEvent[] = [];
    const foreignEvents: RealtimeEvent[] = [];
    const scope = { organizationId: orgA, branchId: branch, queueId: queue, ticketId: ticket };

    await first.subscribe({
      userId: 'user-a',
      channel: first.ticketChannel(scope),
      onEvent: (event) => firstEvents.push(event),
    });
    await second.subscribe({
      userId: 'user-b',
      channel: second.ticketChannel(scope),
      onEvent: (event) => secondEvents.push(event),
    });
    await second.subscribe({
      userId: 'user-c',
      channel: second.ticketChannel({ ...scope, organizationId: orgB }),
      onEvent: (event) => foreignEvents.push(event),
    });

    const event = createRealtimeEvent({
      name: 'ticket.called',
      scope,
      payload: { status: 'called' },
    });
    await first.publish(event);

    expect(firstEvents).toEqual([event]);
    expect(secondEvents).toEqual([event]);
    expect(foreignEvents).toEqual([]);
    await first.stop();
    await second.stop();
  });

  it('delivers to multiple local subscribers and releases the transport after cleanup', async () => {
    const broker = new SharedBroker();
    const transport = new BrokerTransport(broker);
    const current = hub(transport);
    const scope = { organizationId: orgA, branchId: branch, queueId: queue };
    const first = jest.fn();
    const second = jest.fn();
    const releaseFirst = await current.subscribe({
      userId: 'user-a',
      channel: current.queueChannel(scope),
      onEvent: first,
    });
    const releaseSecond = await current.subscribe({
      userId: 'user-b',
      channel: current.queueChannel(scope),
      onEvent: second,
    });
    const event = createRealtimeEvent({
      name: 'queue.summary_updated',
      scope,
      payload: { reason: 'test' },
    });

    await current.publish(event);
    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);

    await releaseFirst();
    await releaseSecond();
    await current.publish(event);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    await current.stop();
  });

  it('keeps local delivery available when Redis publication fails', async () => {
    const transport: RealtimePubSubTransport = {
      enabled: true,
      start: async () => undefined,
      stop: async () => undefined,
      publish: async () => {
        throw new Error('Redis unavailable');
      },
      subscribe: async () => async () => undefined,
    };
    const current = hub(transport);
    const scope = { organizationId: orgA, branchId: branch, queueId: queue };
    const received = jest.fn();
    await current.subscribe({
      userId: 'user-a',
      channel: current.queueChannel(scope),
      onEvent: received,
    });
    const event = createRealtimeEvent({
      name: 'queue.summary_updated',
      scope,
      payload: { reason: 'redis_outage_test' },
    });

    await expect(current.publish(event)).resolves.toBeUndefined();
    expect(received).toHaveBeenCalledWith(event);
    await current.stop();
  });

  it('enforces per-account connection limits', async () => {
    const current = new RealtimeHub(new BrokerTransport(new SharedBroker()), {
      keyPrefix: 'sqa',
      maxConnections: 2,
      maxConnectionsPerUser: 1,
    });
    const channel = current.queueChannel({
      organizationId: orgA,
      branchId: branch,
      queueId: queue,
    });
    await current.subscribe({ userId: 'user-a', channel, onEvent: jest.fn() });

    await expect(
      current.subscribe({ userId: 'user-a', channel, onEvent: jest.fn() })
    ).rejects.toMatchObject({ statusCode: 429 });
    await current.stop();
  });
});
