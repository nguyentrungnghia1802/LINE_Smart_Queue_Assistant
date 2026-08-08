import Redis from 'ioredis';

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

export type RedisHealthStatus =
  'disabled' | 'connecting' | 'ready' | 'degraded' | 'closing' | 'closed';

export interface RedisCommandClient {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
}

export interface ManagedRedisClient extends RedisCommandClient {
  readonly status: string;
  connect(): Promise<void>;
  ping(): Promise<string>;
  quit(): Promise<'OK'>;
  disconnect(reconnect?: boolean): void;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'connect' | 'ready' | 'close' | 'reconnecting' | 'end', listener: () => void): this;
}

export interface RedisServiceOptions {
  url: string;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
}

export type RedisClientFactory = (options: RedisServiceOptions) => ManagedRedisClient;

export class RedisUnavailableError extends Error {
  constructor(message = 'Redis is temporarily unavailable') {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

export class RedisCommandTimeoutError extends Error {
  constructor() {
    super('Redis command timed out');
    this.name = 'RedisCommandTimeoutError';
  }
}

function defaultClientFactory(options: RedisServiceOptions): ManagedRedisClient {
  return new Redis(options.url, {
    lazyConnect: true,
    connectTimeout: options.connectTimeoutMs,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(100 * 2 ** Math.min(attempt - 1, 5), 2_000),
  }) as ManagedRedisClient;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, error: Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(error), timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason: unknown) => {
        clearTimeout(timer);
        reject(reason);
      }
    );
  });
}

export class RedisService {
  private client: ManagedRedisClient | null = null;
  private healthStatus: RedisHealthStatus;
  private stopping = false;

  constructor(
    private readonly options: RedisServiceOptions,
    private readonly clientFactory: RedisClientFactory = defaultClientFactory
  ) {
    this.healthStatus = options.url ? 'closed' : 'disabled';
  }

  get enabled(): boolean {
    return this.options.url.length > 0;
  }

  get isReady(): boolean {
    return this.client?.status === 'ready';
  }

  health(): { enabled: boolean; status: RedisHealthStatus } {
    return { enabled: this.enabled, status: this.healthStatus };
  }

  async start(): Promise<void> {
    if (!this.enabled || this.client) return;

    this.stopping = false;
    this.healthStatus = 'connecting';
    const client = this.clientFactory(this.options);
    this.client = client;
    this.bindLifecycle(client);

    try {
      await withTimeout(
        client.connect(),
        this.options.connectTimeoutMs,
        new RedisUnavailableError('Redis connection timed out')
      );
      this.healthStatus = 'ready';
    } catch (error) {
      this.healthStatus = 'degraded';
      metricsService.increment('redis_connection_errors_total');
      logger.warn({ errorType: this.errorType(error) }, 'Redis unavailable during startup');
    }
  }

  async execute<T>(operation: (client: RedisCommandClient) => Promise<T>): Promise<T> {
    const client = this.client;
    if (!client || client.status !== 'ready') throw new RedisUnavailableError();

    try {
      const result = await withTimeout(
        operation(client),
        this.options.commandTimeoutMs,
        new RedisCommandTimeoutError()
      );
      if (!this.stopping && client.status === 'ready') this.healthStatus = 'ready';
      return result;
    } catch (error) {
      if (error instanceof RedisCommandTimeoutError) {
        metricsService.increment('redis_command_timeouts_total');
      }
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.execute((client) => (client as ManagedRedisClient).ping())) === 'PONG';
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    const client = this.client;
    if (!client) {
      this.healthStatus = this.enabled ? 'closed' : 'disabled';
      return;
    }

    this.stopping = true;
    this.healthStatus = 'closing';
    try {
      if (client.status === 'ready') {
        await withTimeout(
          client.quit(),
          this.options.connectTimeoutMs,
          new RedisUnavailableError('Redis shutdown timed out')
        );
      } else {
        client.disconnect(false);
      }
    } catch (error) {
      logger.warn({ errorType: this.errorType(error) }, 'Redis graceful shutdown failed');
      client.disconnect(false);
    } finally {
      this.client = null;
      this.healthStatus = 'closed';
    }
  }

  private bindLifecycle(client: ManagedRedisClient): void {
    client.on('connect', () => {
      if (!this.stopping) this.healthStatus = 'connecting';
    });
    client.on('ready', () => {
      if (!this.stopping) {
        this.healthStatus = 'ready';
        logger.info('Redis connection ready');
      }
    });
    client.on('error', (error) => {
      if (!this.stopping) {
        this.healthStatus = 'degraded';
        metricsService.increment('redis_connection_errors_total');
        logger.warn({ errorType: this.errorType(error) }, 'Redis connection error');
      }
    });
    client.on('close', () => {
      if (!this.stopping) this.healthStatus = 'degraded';
    });
    client.on('reconnecting', () => {
      if (!this.stopping) this.healthStatus = 'connecting';
    });
    client.on('end', () => {
      if (!this.stopping) this.healthStatus = 'degraded';
    });
  }

  private errorType(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}

export const redisService = new RedisService({
  url: config.redis.url,
  connectTimeoutMs: config.redis.connectTimeoutMs,
  commandTimeoutMs: config.redis.commandTimeoutMs,
});
