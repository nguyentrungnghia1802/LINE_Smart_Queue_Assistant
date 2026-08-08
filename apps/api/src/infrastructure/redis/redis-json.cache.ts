import { performance } from 'node:perf_hooks';

import type { SupportedLocale } from '@line-queue/shared';

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metricsService } from '../../utils/metrics';

import { type RedisCommandClient, redisService } from './redis.service';

const CACHE_VERSION = 1;
const SUPPORTED_LOCALES: SupportedLocale[] = ['ja', 'vi', 'en'];

export interface RedisCacheService {
  readonly enabled: boolean;
  execute<T>(operation: (client: RedisCommandClient) => Promise<T>): Promise<T>;
}

interface CacheEnvelope {
  version: number;
  value: unknown;
}

export interface CacheAsideOptions<T> {
  cacheName: 'public_branch_booking' | 'public_queue_summary';
  key: string;
  ttlMs: number;
  load: () => Promise<T>;
  parse: (value: unknown) => T | undefined;
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function isEnvelope(value: unknown): value is CacheEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'value' in value &&
    (value as { version?: unknown }).version === CACHE_VERSION
  );
}

function recordCacheResult(result: 'hit' | 'miss' | 'error'): void {
  if (result === 'hit') metricsService.increment('redis_cache_hits_total');
  if (result === 'miss') metricsService.increment('redis_cache_misses_total');
  if (result === 'error') metricsService.increment('redis_cache_errors_total');

  const snapshot = metricsService.snapshot();
  const decisions = snapshot.redis_cache_hits_total + snapshot.redis_cache_misses_total;
  metricsService.setGauge(
    'redis_cache_hit_ratio',
    decisions === 0 ? 0 : snapshot.redis_cache_hits_total / decisions
  );
}

export class RedisJsonCache {
  constructor(private readonly redis: RedisCacheService = redisService) {}

  async getOrLoad<T>(options: CacheAsideOptions<T>): Promise<T> {
    if (!this.redis.enabled) {
      recordCacheResult('miss');
      return options.load();
    }

    let canWrite = true;
    try {
      const raw = await this.timed((client) => client.get(options.key));
      if (raw !== null) {
        try {
          const envelope: unknown = JSON.parse(raw);
          const parsed = isEnvelope(envelope) ? options.parse(envelope.value) : undefined;
          if (parsed !== undefined) {
            recordCacheResult('hit');
            return parsed;
          }
        } catch (error) {
          logger.warn(
            { cacheName: options.cacheName, errorType: errorType(error) },
            'Redis read-model cache value could not be parsed'
          );
        }

        recordCacheResult('error');
        await this.deleteBestEffort([options.key], options.cacheName);
      }
      recordCacheResult('miss');
    } catch (error) {
      canWrite = false;
      recordCacheResult('error');
      logger.warn(
        { cacheName: options.cacheName, errorType: errorType(error) },
        'Redis read-model cache read failed; loading from PostgreSQL'
      );
    }

    const value = await options.load();
    if (!canWrite) return value;
    try {
      const serialized = JSON.stringify({ version: CACHE_VERSION, value });
      await this.timed((client) => client.set(options.key, serialized, 'PX', options.ttlMs));
    } catch (error) {
      recordCacheResult('error');
      logger.warn(
        { cacheName: options.cacheName, errorType: errorType(error) },
        'Redis read-model cache write failed; returning PostgreSQL result'
      );
    }
    return value;
  }

  async invalidate(
    keys: string[],
    cacheName: CacheAsideOptions<unknown>['cacheName']
  ): Promise<void> {
    if (!this.redis.enabled || keys.length === 0) return;
    await this.deleteBestEffort(Array.from(new Set(keys)), cacheName);
  }

  private async deleteBestEffort(
    keys: string[],
    cacheName: CacheAsideOptions<unknown>['cacheName']
  ): Promise<void> {
    try {
      await this.timed((client) => client.del(...keys));
    } catch (error) {
      recordCacheResult('error');
      logger.warn(
        { cacheName, errorType: errorType(error) },
        'Redis read-model cache invalidation failed'
      );
    }
  }

  private async timed<T>(operation: (client: RedisCommandClient) => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await this.redis.execute(operation);
    } finally {
      metricsService.setGauge(
        'redis_cache_latency_seconds',
        Math.max(0, performance.now() - startedAt) / 1_000
      );
    }
  }
}

function publicBranchBookingKey(params: {
  organizationId: string;
  branchId: string;
  locale: SupportedLocale;
}): string {
  return `${config.redis.keyPrefix}:v1:org:${params.organizationId}:branch:${params.branchId}:public-booking:${params.locale}`;
}

function publicQueueSummaryKey(params: {
  organizationId: string;
  branchId: string;
  queueId: string;
}): string {
  return `${config.redis.keyPrefix}:v1:org:${params.organizationId}:branch:${params.branchId}:queue:${params.queueId}:public-summary`;
}

const cache = new RedisJsonCache();

export const publicReadModelCache = {
  enabled: redisService.enabled,
  branchKey: publicBranchBookingKey,
  queueKey: publicQueueSummaryKey,

  getBranchBooking<T>(params: {
    organizationId: string;
    branchId: string;
    locale: SupportedLocale;
    load: () => Promise<T>;
    parse: (value: unknown) => T | undefined;
  }): Promise<T> {
    return cache.getOrLoad({
      cacheName: 'public_branch_booking',
      key: publicBranchBookingKey(params),
      ttlMs: config.redis.publicBranchCacheTtlMs,
      load: params.load,
      parse: params.parse,
    });
  },

  getQueueSummary<T>(params: {
    organizationId: string;
    branchId: string;
    queueId: string;
    load: () => Promise<T>;
    parse: (value: unknown) => T | undefined;
  }): Promise<T> {
    return cache.getOrLoad({
      cacheName: 'public_queue_summary',
      key: publicQueueSummaryKey(params),
      ttlMs: config.redis.publicQueueCacheTtlMs,
      load: params.load,
      parse: params.parse,
    });
  },

  invalidateBranch(organizationId: string, branchId: string): Promise<void> {
    return cache.invalidate(
      SUPPORTED_LOCALES.map((locale) =>
        publicBranchBookingKey({ organizationId, branchId, locale })
      ),
      'public_branch_booking'
    );
  },

  async invalidateQueue(params: {
    organizationId: string;
    branchId: string;
    queueId: string;
  }): Promise<void> {
    await cache.invalidate(
      [
        publicQueueSummaryKey(params),
        ...SUPPORTED_LOCALES.map((locale) =>
          publicBranchBookingKey({
            organizationId: params.organizationId,
            branchId: params.branchId,
            locale,
          })
        ),
      ],
      'public_queue_summary'
    );
  },
};
