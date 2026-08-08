import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it } from '@jest/globals';

import { metricsService } from '../../../utils/metrics';
import { ManagedRedisClient, RedisCommandTimeoutError, RedisService } from '../redis.service';

class FakeRedisClient extends EventEmitter {
  status = 'wait';
  connectError: Error | null = null;
  autoReady = true;
  quitCalls = 0;
  disconnectCalls = 0;

  async connect(): Promise<void> {
    this.status = 'connecting';
    this.emit('connect');
    if (this.connectError) throw this.connectError;
    if (this.autoReady) {
      this.status = 'ready';
      this.emit('ready');
    }
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.quitCalls += 1;
    this.status = 'end';
    this.emit('end');
    return 'OK';
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.status = 'end';
    this.emit('end');
  }

  async eval(): Promise<unknown> {
    return [1, 60_000];
  }

  async del(): Promise<number> {
    return 1;
  }

  async get(): Promise<string | null> {
    return null;
  }

  async set(): Promise<'OK'> {
    return 'OK';
  }
}

function createService(client: FakeRedisClient, commandTimeoutMs = 25): RedisService {
  return new RedisService(
    {
      url: 'redis://test.invalid:6379',
      connectTimeoutMs: 25,
      commandTimeoutMs,
    },
    () => client as unknown as ManagedRedisClient
  );
}

beforeEach(() => {
  metricsService.resetForTests();
});

describe('RedisService', () => {
  it('connects and reports safe ready health when Redis is available', async () => {
    const client = new FakeRedisClient();
    const service = createService(client);

    await service.start();

    expect(service.health()).toEqual({ enabled: true, status: 'ready' });
    await expect(service.ping()).resolves.toBe(true);
  });

  it('continues in degraded mode when Redis is unavailable at startup', async () => {
    const client = new FakeRedisClient();
    client.connectError = new Error('connection refused');
    const service = createService(client);

    await expect(service.start()).resolves.toBeUndefined();

    expect(service.health()).toEqual({ enabled: true, status: 'degraded' });
    expect(metricsService.snapshot().redis_connection_errors_total).toBe(1);
  });

  it('tracks a runtime disconnect and subsequent reconnect', async () => {
    const client = new FakeRedisClient();
    const service = createService(client);
    await service.start();

    client.status = 'close';
    client.emit('close');
    expect(service.health().status).toBe('degraded');

    client.status = 'reconnecting';
    client.emit('reconnecting');
    expect(service.health().status).toBe('connecting');

    client.status = 'ready';
    client.emit('ready');
    expect(service.health().status).toBe('ready');
  });

  it('bounds command latency with an explicit timeout', async () => {
    const client = new FakeRedisClient();
    const service = createService(client, 5);
    await service.start();

    await expect(service.execute(() => new Promise<never>(() => undefined))).rejects.toBeInstanceOf(
      RedisCommandTimeoutError
    );
    expect(metricsService.snapshot().redis_command_timeouts_total).toBe(1);
  });

  it('closes the shared client gracefully', async () => {
    const client = new FakeRedisClient();
    const service = createService(client);
    await service.start();

    await service.stop();

    expect(client.quitCalls).toBe(1);
    expect(service.health()).toEqual({ enabled: true, status: 'closed' });
  });
});
