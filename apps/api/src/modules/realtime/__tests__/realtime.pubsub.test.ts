import { EventEmitter } from 'node:events';

import { type RealtimeRedisClient, RedisRealtimePubSub } from '../realtime.pubsub';

class FakeRedisClient extends EventEmitter implements RealtimeRedisClient {
  status = 'wait';
  readonly published: Array<{ channel: string; message: string }> = [];
  readonly subscriptions: string[] = [];
  readonly unsubscriptions: string[] = [];

  async connect(): Promise<void> {
    this.status = 'ready';
    this.emit('ready');
  }

  async publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message });
    return 1;
  }

  async subscribe(channel: string): Promise<number> {
    this.subscriptions.push(channel);
    return this.subscriptions.length;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.unsubscriptions.push(channel);
    return 0;
  }

  async quit(): Promise<'OK'> {
    this.status = 'end';
    return 'OK';
  }

  disconnect(): void {
    this.status = 'end';
  }

  reconnect(): void {
    this.status = 'ready';
    this.emit('reconnecting');
    this.emit('ready');
  }
}

describe('RedisRealtimePubSub', () => {
  it('restores active subscriptions after Redis reconnects', async () => {
    const clients: FakeRedisClient[] = [];
    const transport = new RedisRealtimePubSub('redis://test', () => {
      const client = new FakeRedisClient();
      clients.push(client);
      return client;
    });
    const handler = jest.fn();
    await transport.subscribe('sqa:realtime:v1:test', handler);
    await transport.start();
    const subscriber = clients[1];
    const initialSubscriptions = subscriber.subscriptions.length;

    subscriber.reconnect();
    await Promise.resolve();
    await Promise.resolve();

    expect(initialSubscriptions).toBeGreaterThan(0);
    expect(subscriber.subscriptions.length).toBeGreaterThan(initialSubscriptions);
    await transport.stop();
  });

  it('drops invalid Redis messages without invoking subscribers', async () => {
    const clients: FakeRedisClient[] = [];
    const transport = new RedisRealtimePubSub('redis://test', () => {
      const client = new FakeRedisClient();
      clients.push(client);
      return client;
    });
    const handler = jest.fn();
    await transport.subscribe('channel', handler);
    await transport.start();

    clients[1].emit('message', 'channel', '{"not":"an-event"}');

    expect(handler).not.toHaveBeenCalled();
    await transport.stop();
  });
});
