import { IncrementResponse, MemoryStore, Options, Store } from 'express-rate-limit';

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import { RedisService, redisService } from './redis.service';

const INCREMENT_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if total == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { total, ttl }
`;

const DECREMENT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > 0 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

export interface RateLimitBackend {
  readonly enabled: boolean;
  increment(key: string, windowMs: number): Promise<IncrementResponse>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

export class RedisRateLimitBackend implements RateLimitBackend {
  constructor(private readonly redis: RedisService = redisService) {}

  get enabled(): boolean {
    return this.redis.enabled;
  }

  async increment(key: string, windowMs: number): Promise<IncrementResponse> {
    const result = await this.redis.execute((client) =>
      client.eval(INCREMENT_SCRIPT, 1, key, windowMs)
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Unexpected Redis rate-limit response');
    }

    const totalHits = Number(result[0]);
    const ttlMs = Number(result[1]);
    if (!Number.isFinite(totalHits) || !Number.isFinite(ttlMs)) {
      throw new Error('Invalid Redis rate-limit response');
    }

    return {
      totalHits,
      resetTime: new Date(Date.now() + Math.max(ttlMs, 0)),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.execute((client) => client.eval(DECREMENT_SCRIPT, 1, key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.execute((client) => client.del(key));
  }
}

export class ResilientRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private readonly fallback = new MemoryStore();
  private windowMs = 60_000;
  private lastFallbackLogAt = 0;

  constructor(
    policyName: string,
    private readonly backend: RateLimitBackend = new RedisRateLimitBackend()
  ) {
    this.prefix = `${config.redis.keyPrefix}:rate-limit:${policyName}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (this.backend.enabled) {
      try {
        return await this.backend.increment(this.fullKey(key), this.windowMs);
      } catch (error) {
        metricsService.increment('redis_rate_limit_fallback_total');
        const now = Date.now();
        if (now - this.lastFallbackLogAt >= 30_000) {
          this.lastFallbackLogAt = now;
          logger.warn(
            { policyPrefix: this.prefix, errorType: this.errorType(error) },
            'Redis rate-limit store unavailable; using bounded local fallback'
          );
        }
      }
    }
    return this.fallback.increment(key);
  }

  async decrement(key: string): Promise<void> {
    await this.fallback.decrement(key);
    if (!this.backend.enabled) return;
    try {
      await this.backend.decrement(this.fullKey(key));
    } catch {
      // The bounded fallback remains authoritative for this process during the outage.
    }
  }

  async resetKey(key: string): Promise<void> {
    await this.fallback.resetKey(key);
    if (!this.backend.enabled) return;
    try {
      await this.backend.resetKey(this.fullKey(key));
    } catch {
      // Redis recovery will naturally expire the remote window.
    }
  }

  resetAll(): void {
    this.fallback.resetAll();
  }

  shutdown(): void {
    this.fallback.shutdown?.();
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private errorType(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}

export const redisRateLimitBackend = new RedisRateLimitBackend();
