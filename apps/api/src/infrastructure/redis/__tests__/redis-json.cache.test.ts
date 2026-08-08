import { metricsService } from '../../../utils/metrics';
import type { RedisCommandClient } from '../redis.service';
import { publicReadModelCache, type RedisCacheService, RedisJsonCache } from '../redis-json.cache';

class FakeRedisService implements RedisCacheService {
  enabled = true;
  now = 0;
  fail = false;
  readonly values = new Map<string, { value: string; expiresAt: number }>();

  private readonly client: RedisCommandClient = {
    eval: async () => null,
    del: async (...keys) => {
      let deleted = 0;
      for (const key of keys) deleted += this.values.delete(key) ? 1 : 0;
      return deleted;
    },
    get: async (key) => {
      const entry = this.values.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= this.now) {
        this.values.delete(key);
        return null;
      }
      return entry.value;
    },
    set: async (key, value, _mode, ttlMs) => {
      this.values.set(key, { value, expiresAt: this.now + ttlMs });
      return 'OK';
    },
  };

  async execute<T>(operation: (client: RedisCommandClient) => Promise<T>): Promise<T> {
    if (this.fail) throw new Error('Redis unavailable');
    return operation(this.client);
  }
}

function numberOptions(load: () => Promise<number>, ttlMs = 100) {
  return {
    cacheName: 'public_queue_summary' as const,
    key: 'sqa:v1:org:org-1:branch:branch-1:queue:queue-1:public-summary',
    ttlMs,
    load,
    parse: (value: unknown) => (typeof value === 'number' ? value : undefined),
  };
}

describe('RedisJsonCache', () => {
  beforeEach(() => metricsService.resetForTests());

  it('loads on miss, then serves a hit without another PostgreSQL loader call', async () => {
    const redis = new FakeRedisService();
    const cache = new RedisJsonCache(redis);
    const load = jest.fn().mockResolvedValue(7);

    await expect(cache.getOrLoad(numberOptions(load))).resolves.toBe(7);
    await expect(cache.getOrLoad(numberOptions(load))).resolves.toBe(7);

    expect(load).toHaveBeenCalledTimes(1);
    expect(metricsService.snapshot()).toMatchObject({
      redis_cache_hits_total: 1,
      redis_cache_misses_total: 1,
    });
  });

  it('reloads stale queue data after the TTL expires', async () => {
    const redis = new FakeRedisService();
    const cache = new RedisJsonCache(redis);
    let waitingCount = 1;
    const load = jest.fn(async () => waitingCount);

    await expect(cache.getOrLoad(numberOptions(load, 50))).resolves.toBe(1);
    waitingCount = 2;
    redis.now = 49;
    await expect(cache.getOrLoad(numberOptions(load, 50))).resolves.toBe(1);
    redis.now = 50;
    await expect(cache.getOrLoad(numberOptions(load, 50))).resolves.toBe(2);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('invalidates an exact key and reloads it on the next request', async () => {
    const redis = new FakeRedisService();
    const cache = new RedisJsonCache(redis);
    const load = jest.fn().mockResolvedValue(3);
    const options = numberOptions(load);

    await cache.getOrLoad(options);
    await cache.invalidate([options.key], 'public_queue_summary');
    await cache.getOrLoad(options);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('falls back to the loader when Redis is unavailable', async () => {
    const redis = new FakeRedisService();
    redis.fail = true;
    const cache = new RedisJsonCache(redis);

    await expect(cache.getOrLoad(numberOptions(async () => 9))).resolves.toBe(9);
    expect(metricsService.snapshot().redis_cache_errors_total).toBeGreaterThan(0);
  });

  it('deletes corrupted values and replaces them with validated data', async () => {
    const redis = new FakeRedisService();
    const cache = new RedisJsonCache(redis);
    const options = numberOptions(async () => 11);
    redis.values.set(options.key, { value: '{not-json', expiresAt: 100 });

    await expect(cache.getOrLoad(options)).resolves.toBe(11);
    expect(redis.values.get(options.key)?.value).toContain('"value":11');
    expect(metricsService.snapshot().redis_cache_errors_total).toBe(1);
  });

  it('builds versioned tenant-safe keys for branch and queue read models', () => {
    const first = publicReadModelCache.queueKey({
      organizationId: 'org-a',
      branchId: 'branch-a',
      queueId: 'queue-a',
    });
    const second = publicReadModelCache.queueKey({
      organizationId: 'org-b',
      branchId: 'branch-a',
      queueId: 'queue-a',
    });
    const ja = publicReadModelCache.branchKey({
      organizationId: 'org-a',
      branchId: 'branch-a',
      locale: 'ja',
    });
    const vi = publicReadModelCache.branchKey({
      organizationId: 'org-a',
      branchId: 'branch-a',
      locale: 'vi',
    });

    expect(first).toContain('sqa:v1:org:org-a:branch:branch-a:queue:queue-a');
    expect(first).not.toBe(second);
    expect(ja).not.toBe(vi);
  });
});
