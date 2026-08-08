import Redis from 'ioredis';

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import { parseRealtimeEvent, type RealtimeEvent } from './realtime.contract';

export type RealtimeMessageHandler = (event: RealtimeEvent) => void;

export interface RealtimePubSubTransport {
  readonly enabled: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(channels: string[], event: RealtimeEvent): Promise<void>;
  subscribe(channel: string, handler: RealtimeMessageHandler): Promise<() => Promise<void>>;
}

export interface RealtimeRedisClient {
  readonly status: string;
  connect(): Promise<void>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<number>;
  unsubscribe(channel: string): Promise<number>;
  quit(): Promise<'OK'>;
  disconnect(reconnect?: boolean): void;
  on(event: 'message', listener: (channel: string, message: string) => void): this;
  on(event: 'ready' | 'close' | 'reconnecting' | 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export type RealtimeRedisClientFactory = (url: string) => RealtimeRedisClient;

function defaultClientFactory(url: string): RealtimeRedisClient {
  return new Redis(url, {
    lazyConnect: true,
    connectTimeout: config.redis.connectTimeoutMs,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(100 * 2 ** Math.min(attempt - 1, 5), 2_000),
  }) as unknown as RealtimeRedisClient;
}

function withStartupTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Realtime Redis connection timed out')),
      config.redis.connectTimeoutMs
    );
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export class RedisRealtimePubSub implements RealtimePubSubTransport {
  private publisher: RealtimeRedisClient | null = null;
  private subscriber: RealtimeRedisClient | null = null;
  private readonly handlers = new Map<string, Set<RealtimeMessageHandler>>();
  private stopping = false;

  constructor(
    private readonly url: string,
    private readonly clientFactory: RealtimeRedisClientFactory = defaultClientFactory
  ) {}

  get enabled(): boolean {
    return this.url.length > 0;
  }

  async start(): Promise<void> {
    if (!this.enabled || this.publisher || this.subscriber) return;

    this.stopping = false;
    this.publisher = this.clientFactory(this.url);
    this.subscriber = this.clientFactory(this.url);
    this.bindClients(this.publisher, this.subscriber);

    const results = await Promise.allSettled([
      withStartupTimeout(this.publisher.connect()),
      withStartupTimeout(this.subscriber.connect()),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      metricsService.increment('redis_pubsub_errors_total');
      logger.warn(
        'Realtime Redis Pub/Sub unavailable during startup; local SSE delivery remains active'
      );
    }
    await this.restoreSubscriptions();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is RealtimeRedisClient => client !== null
    );
    this.publisher = null;
    this.subscriber = null;
    await Promise.all(
      clients.map(async (client) => {
        try {
          if (client.status === 'ready') await client.quit();
          else client.disconnect(false);
        } catch {
          client.disconnect(false);
        }
      })
    );
  }

  async publish(channels: string[], event: RealtimeEvent): Promise<void> {
    const publisher = this.publisher;
    if (!this.enabled || !publisher || publisher.status !== 'ready') {
      throw new Error('Realtime Redis publisher is unavailable');
    }
    const message = JSON.stringify(event);
    await Promise.all(channels.map((channel) => publisher.publish(channel, message)));
  }

  async subscribe(channel: string, handler: RealtimeMessageHandler): Promise<() => Promise<void>> {
    const handlers = this.handlers.get(channel) ?? new Set<RealtimeMessageHandler>();
    const first = handlers.size === 0;
    handlers.add(handler);
    this.handlers.set(channel, handlers);

    if (first && this.subscriber?.status === 'ready') {
      try {
        await this.subscriber.subscribe(channel);
      } catch (error) {
        this.recordError(error, 'Realtime Redis subscribe failed');
      }
    }

    let active = true;
    return async () => {
      if (!active) return;
      active = false;
      const current = this.handlers.get(channel);
      current?.delete(handler);
      if (current && current.size > 0) return;
      this.handlers.delete(channel);
      if (this.subscriber?.status === 'ready') {
        try {
          await this.subscriber.unsubscribe(channel);
        } catch (error) {
          this.recordError(error, 'Realtime Redis unsubscribe failed');
        }
      }
    };
  }

  private bindClients(publisher: RealtimeRedisClient, subscriber: RealtimeRedisClient): void {
    subscriber.on('message', (channel, message) => {
      const event = parseRealtimeEvent(message);
      if (!event) {
        metricsService.increment('realtime_invalid_events_total');
        return;
      }
      for (const handler of this.handlers.get(channel) ?? []) handler(event);
    });
    subscriber.on('ready', () => {
      if (!this.stopping) void this.restoreSubscriptions();
    });

    for (const client of [publisher, subscriber]) {
      client.on('error', (error) => this.recordError(error, 'Realtime Redis connection error'));
      client.on('reconnecting', () => {
        if (!this.stopping) metricsService.increment('redis_pubsub_reconnects_total');
      });
      client.on('close', () => undefined);
      client.on('end', () => undefined);
    }
  }

  private async restoreSubscriptions(): Promise<void> {
    const subscriber = this.subscriber;
    if (!subscriber || subscriber.status !== 'ready' || this.handlers.size === 0) return;
    try {
      await Promise.all([...this.handlers.keys()].map((channel) => subscriber.subscribe(channel)));
    } catch (error) {
      this.recordError(error, 'Realtime Redis resubscribe failed');
    }
  }

  private recordError(error: unknown, message: string): void {
    metricsService.increment('redis_pubsub_errors_total');
    logger.warn({ errorType: error instanceof Error ? error.name : 'UnknownError' }, message);
  }
}

export class LocalRealtimePubSub implements RealtimePubSubTransport {
  readonly enabled = false;

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async publish(_channels: string[], _event: RealtimeEvent): Promise<void> {}
  async subscribe(
    _channel: string,
    _handler: RealtimeMessageHandler
  ): Promise<() => Promise<void>> {
    return async () => undefined;
  }
}

export const realtimePubSub: RealtimePubSubTransport = config.redis.url
  ? new RedisRealtimePubSub(config.redis.url)
  : new LocalRealtimePubSub();
